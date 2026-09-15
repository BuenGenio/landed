/** GET /api/referrals/:code?email=  public: is this referral code usable? */
import { getDb } from '../../lib/db.js'
import { json, options } from '../../lib/http.js'
import { checkReferral } from '../../lib/orders.js'

export async function onRequestGet({ request, env, params }) {
  const email = new URL(request.url).searchParams.get('email') || undefined
  const r = await checkReferral(getDb(env), params.code, { email })
  return json({ valid: r.valid, reason: r.reason || null, discount: r.valid ? r.discount : 0 })
}
export const onRequestOptions = options
