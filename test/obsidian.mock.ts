export async function requestUrl(): Promise<never> {
  throw new Error('requestUrl must be mocked by the test.');
}

export class Modal {
  constructor(..._args: unknown[]) {}
}

export class Notice {
  constructor(..._args: unknown[]) {}
}

export class PluginSettingTab {
  getControlValue(_key: string): unknown {
    return undefined;
  }

  getSettingDefinitions(): unknown[] {
    return [];
  }

  setControlValue(_key: string, _value: unknown): void {}

  update(): void {}
}

export class SecretComponent {
  constructor(..._args: unknown[]) {}
}

export class Setting {
  constructor(..._args: unknown[]) {}
}

export function parseYaml(value: string): unknown {
  return value;
}
