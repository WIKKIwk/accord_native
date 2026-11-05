import { serverEndpointStore } from './serverEndpointRuntime';

export class MobileApi {
  /** @v2 instance */
  static readonly instance = new MobileApi();
  private constructor() {}

  /** @v2 baseUrl */
  static get baseUrl(): string { return serverEndpointStore.baseUrl; }
  get baseUrl(): string { return MobileApi.baseUrl; }
}
