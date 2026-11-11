// In-memory access token storage — never localStorage or cookies for access tokens per Blueprint §7 & PRD §3
let _token: string | null = null;

export const tokenStore = {
  get: (): string | null => _token,
  set: (token: string): void => {
    _token = token;
  },
  clear: (): void => {
    _token = null;
  },
};

