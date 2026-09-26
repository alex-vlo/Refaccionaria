import bcrypt from 'bcrypt'
import { ROUNDS } from './constants.js'

export function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS)
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}
