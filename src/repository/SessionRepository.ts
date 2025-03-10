import { Session } from '../service/BlackboxaiService.ts';

const kv = await Deno.openKv();

export function createSession(session: Session): Promise<Deno.KvCommitResult> {
  return kv.set(['session'], session, { expireIn: new Date(session.expires).getTime() });
}

export async function getSession(): Promise<Session | null> {
  return (await kv.get<Session>(['session'])).value;
}