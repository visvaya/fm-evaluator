import * as z from 'zod';

import { configureZodForStrictCsp } from './zodConfig';

describe('configureZodForStrictCsp', () => {
  it('turns off the Function() JIT probe so the strict CSP sees no eval', () => {
    configureZodForStrictCsp();

    expect(z.config().jitless).toBe(true);
  });

  it('keeps parsing working without the JIT', () => {
    configureZodForStrictCsp();

    const playerSchema = z.object({ age: z.number(), name: z.string().trim() });

    expect(playerSchema.parse({ age: 30, name: 'Lewandowski' })).toEqual({
      age: 30,
      name: 'Lewandowski'
    });
    expect(playerSchema.safeParse({ age: 'x', name: 1 }).success).toBe(false);
  });
});
