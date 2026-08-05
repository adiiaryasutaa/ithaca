import { encryptText } from '../../utils/crypto.js';
import * as providerConfigRepository from './provider-config.repository.js';

export async function createGoogleProviderConfig(
  userId: string,
  body: { clientId: string; clientSecret: string; redirectUri: string; scopes: string[] },
) {
  const config = await providerConfigRepository.createGoogleProviderConfig({
    userId,
    clientIdEncrypted: encryptText(body.clientId),
    clientSecretEncrypted: encryptText(body.clientSecret),
    redirectUri: body.redirectUri,
    scopes: body.scopes,
  });
  return {
    id: config.id,
    provider: config.provider,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    status: config.status,
  };
}

export function listProviderConfigs() {
  return providerConfigRepository.findAllProviderConfigs();
}

export async function deleteProviderConfig(id: string) {
  await providerConfigRepository.deleteProviderConfigById(id);
}
