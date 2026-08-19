import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL="https://xncnfghkdcdjqvnovcqt.supabase.co"
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_ZGJmtDUfHQFm8tg8QAqhzw_hH6l9kEI"
const SUPABASE_SECRET_KEY="sb_secret_6Imc2-_ik3u42JZFCUYHgQ_FZAaOjW3"
const SUPABASE_JWKS_URL="https://xncnfghkdcdjqvnovcqt.supabase.co/auth/v1/.well-known/jwks.json"

export const supabase = createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY)