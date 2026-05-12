import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;

function configure() {
  if (configured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushToAllAdmins(payload: {
  title: string;
  body: string;
  url?: string;
}) {
  if (!configure()) {
    console.warn("Push: VAPID env not configured, skipping.");
    return;
  }

  const subscriptions = await db.pushSubscription.findMany();
  const json = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // expired subscription
          await db.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => null);
        } else {
          console.error("Push send error:", err);
        }
      }
    })
  );
}
