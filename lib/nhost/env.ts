export function getNhostEnv() {
  return {
    subdomain:
      process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN ?? "dqftmpnxwgmnppgjqorh",
    region: process.env.NEXT_PUBLIC_NHOST_REGION ?? "eu-central-1",
  };
}
