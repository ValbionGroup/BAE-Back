import type { ApplicationService } from '@adonisjs/core/types'
import LydiaClient from '#services/lydia/lydia_client'
import HttpLydiaClient from '#services/lydia/http_lydia_client'
import FakeLydiaClient from '#services/lydia/fake_lydia_client'
import lydiaConfig from '#config/lydia'

export default class LydiaProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    // `singleton` et non `bind` : le client simulé porte l'état que les tests
    // règlent avant d'appeler l'API. Une instance neuve par résolution le perdrait.
    this.app.container.singleton(LydiaClient, () =>
      lydiaConfig.driver === 'fake'
        ? new FakeLydiaClient()
        : new HttpLydiaClient(lydiaConfig.url, lydiaConfig.vendorToken)
    )
  }
}
