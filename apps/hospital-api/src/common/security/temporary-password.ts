import { randomInt } from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

function pick(source: string): string {
  return source[randomInt(source.length)];
}

export function generateTemporaryPassword(length = 16): string {
  if (length < 12) throw new Error('Mật khẩu tạm phải có ít nhất 12 ký tự.');

  const characters = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (characters.length < length) characters.push(pick(ALL));

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }

  return characters.join('');
}
