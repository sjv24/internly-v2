import bcrypt from "bcryptjs";
// bcrypt is a deliberately SLOW one-way hash with a built-in random salt: even if the
// database leaks, guessing passwords is expensive. Cost 10 = 2^10 rounds.
const COST = 10;
export const hashPassword = (plain) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
// Used when the email is unknown, so "no such user" takes as long as "wrong password"
// and attackers cannot tell which emails exist by measuring response time.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);
