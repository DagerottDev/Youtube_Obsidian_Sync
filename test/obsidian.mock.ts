export async function requestUrl(): Promise<never> {
  throw new Error('requestUrl must be mocked by the test.');
}
