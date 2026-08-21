import { NobleCryptoPlugin, ScureBase32Plugin, TOTP } from 'otplib'
import encryption from '@adonisjs/core/services/encryption'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import UserTwoFactor from '#models/user_two_factor'
import TwoFactorRecoveryCode from '#models/two_factor_recovery_code'
import { digestRecoveryCode, randomRecoveryCode } from '#services/token_digest'

const ISSUER = 'BAE'
const EPOCH_TOLERANCE_SECONDS = 30
const RECOVERY_CODE_COUNT = 10

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
})

export interface TwoFactorState {
  twoFactorEnabled: boolean
  twoFactorConfirmedAt: string | null
  recoveryCodesRemaining: number
}

async function confirmedRow(userId: number): Promise<UserTwoFactor | null> {
  return UserTwoFactor.query().where('userId', userId).whereNotNull('confirmedAt').first()
}

export async function activeSecretExists(userId: number): Promise<boolean> {
  return (await confirmedRow(userId)) !== null
}

export async function twoFactorStateOf(userId: number): Promise<TwoFactorState> {
  const row = await confirmedRow(userId)
  if (row === null) {
    return { twoFactorEnabled: false, twoFactorConfirmedAt: null, recoveryCodesRemaining: 0 }
  }

  const [{ count }] = await db
    .from('two_factor_recovery_codes')
    .where('user_id', userId)
    .whereNull('used_at')
    .count('* as count')

  return {
    twoFactorEnabled: true,
    twoFactorConfirmedAt: row.confirmedAt?.toISO() ?? null,
    recoveryCodesRemaining: Number(count),
  }
}

export async function startEnrolment(
  userId: number,
  email: string
): Promise<{ secret: string; otpauthUri: string }> {
  await UserTwoFactor.query().where('userId', userId).whereNull('confirmedAt').delete()

  const secret = totp.generateSecret()

  await UserTwoFactor.create({
    userId,
    secret: encryption.encrypt(secret),
  })

  return { secret, otpauthUri: totp.toURI({ issuer: ISSUER, label: email, secret }) }
}

export async function confirmEnrolment(userId: number, code: string): Promise<string[] | null> {
  const row = await UserTwoFactor.query().where('userId', userId).whereNull('confirmedAt').first()
  if (row === null) return null

  const result = await totp.verify(code, {
    secret: encryption.decrypt<string>(row.secret) ?? '',
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
  })
  if (!result.valid) return null

  row.confirmedAt = DateTime.now()
  row.lastUsedCounter = result.timeStep
  await row.save()

  return issueRecoveryCodes(userId)
}

export async function verifyTotp(userId: number, code: string): Promise<boolean> {
  const row = await confirmedRow(userId)
  if (row === null) return false

  const result = await totp.verify(code, {
    secret: encryption.decrypt<string>(row.secret) ?? '',
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
    afterTimeStep: row.lastUsedCounter ?? undefined,
  })
  if (!result.valid) return false

  row.lastUsedCounter = result.timeStep
  await row.save()

  return true
}

export async function consumeRecoveryCode(userId: number, code: string): Promise<boolean> {
  const affected = await db
    .from('two_factor_recovery_codes')
    .where('user_id', userId)
    .where('code_digest', digestRecoveryCode(code))
    .whereNull('used_at')
    .update({ used_at: DateTime.now().toSQL() })

  return Number(affected) > 0
}

export async function issueRecoveryCodes(userId: number): Promise<string[]> {
  await TwoFactorRecoveryCode.query().where('userId', userId).delete()

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomRecoveryCode())

  await TwoFactorRecoveryCode.createMany(
    codes.map((code) => ({ userId, codeDigest: digestRecoveryCode(code) }))
  )

  return codes
}

export async function disable(userId: number): Promise<void> {
  await TwoFactorRecoveryCode.query().where('userId', userId).delete()
  await UserTwoFactor.query().where('userId', userId).delete()
}
