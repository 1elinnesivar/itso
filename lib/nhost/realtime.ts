import { createClient as createWebSocketClient } from "graphql-ws";
import { getNhostClient } from "./client";
import { getNhostEnv } from "./env";

export function subscribeToRecordChanges(onChange: () => void) {
  const { subdomain, region } = getNhostEnv();
  const socket = createWebSocketClient({
    url: `wss://${subdomain}.graphql.${region}.nhost.run/v1`,
    lazy: true,
    retryAttempts: Infinity,
    connectionParams: () => {
      const token = getNhostClient().getUserSession()?.accessToken;
      return token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
    },
  });
  const listener = {
    next: onChange,
    error: () => undefined,
    complete: () => undefined,
  };
  const subscriptions = [
    `subscription LiveRecords { records { id version updated_at } }`,
    `subscription LiveContacts { contact_people { id display_name } }`,
    `subscription LiveRecordContacts { record_contacts { record_id contact_person_id position } }`,
  ].map((query) => socket.subscribe({ query }, listener));

  return () => {
    for (const dispose of subscriptions) dispose();
    void socket.dispose();
  };
}
