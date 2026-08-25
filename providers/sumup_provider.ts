import type { ApplicationService } from '@adonisjs/core/types'
import SumUpClient from '#services/sumup/sumup_client'
import HttpSumUpClient from '#services/sumup/http_sumup_client'
import FakeSumUpClient from '#services/sumup/fake_sumup_client'
import sumupConfig from '#config/sumup'

export default class SumUpProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(SumUpClient, () =>
      sumupConfig.driver === 'fake'
        ? new FakeSumUpClient()
        : new HttpSumUpClient(
            sumupConfig.url,
            sumupConfig.apiKey,
            sumupConfig.merchantCode,
            sumupConfig.readerId
          )
    )
  }
}
