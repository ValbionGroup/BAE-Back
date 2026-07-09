import { BaseTransformer } from '@adonisjs/core/transformers'
import Member from "#models/member";

export default class MemberTransformer extends BaseTransformer<Member> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'firstName', 'lastName', 'points', 'createdAt', 'updatedAt']),
      role: this.resource.role?.name ?? null,
    }
  }
}
