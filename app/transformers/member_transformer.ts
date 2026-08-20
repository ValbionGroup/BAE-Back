import { BaseTransformer } from '@adonisjs/core/transformers'
import type Member from '#models/member'

/**
 * `firstName` / `lastName` restent à plat dans la charge utile alors qu'ils
 * vivent désormais sur `users` : le front les lit ainsi depuis toujours, et le
 * déplacement de colonne ne le concerne pas. Tout appelant doit donc
 * `preload('user')`, sinon les deux champs sortent à `null` en silence.
 */
export default class MemberTransformer extends BaseTransformer<Member> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'points', 'createdAt', 'updatedAt']),
      firstName: this.resource.user?.firstName ?? null,
      lastName: this.resource.user?.lastName ?? null,
      role: this.resource.role?.name ?? null,
    }
  }
}
