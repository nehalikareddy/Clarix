const bcrypt = require('bcryptjs');
const User = require('../models/User');

// These tests exercise the User model's password logic in isolation,
// without needing a live MongoDB connection: mongoose lets us build
// document instances and run schema hooks/methods directly.

describe('User model - comparePassword', () => {
  test('returns true when the plain password matches the stored hash', async () => {
    const plainPassword = 'MySecurePass123!';
    const hash = await bcrypt.hash(plainPassword, 10);

    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: hash
    });

    await expect(user.comparePassword(plainPassword)).resolves.toBe(true);
  });

  test('returns false when the plain password does not match the stored hash', async () => {
    const hash = await bcrypt.hash('CorrectPassword', 10);

    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: hash
    });

    await expect(user.comparePassword('WrongPassword')).resolves.toBe(false);
  });
});

describe('User model - pre-save password hashing hook', () => {
  test('hashes a new/modified passwordHash before save', async () => {
    const plainPassword = 'PlainTextPassword1';
    const user = new User({
      name: 'Test User',
      email: 'test2@example.com',
      passwordHash: plainPassword
    });

    // Run the schema's pre('save') hook directly against this document,
    // the same hook mongoose runs internally on user.save().
    await User.schema.s.hooks.execPre('save', user, []);

    // The stored value should no longer equal the plaintext password...
    expect(user.passwordHash).not.toBe(plainPassword);
    // ...but should be a valid bcrypt hash that verifies against it.
    await expect(bcrypt.compare(plainPassword, user.passwordHash)).resolves.toBe(true);
  });

  test('does not re-hash passwordHash if it was not modified', async () => {
    const existingHash = await bcrypt.hash('AlreadyHashed', 10);
    const user = new User({
      name: 'Test User',
      email: 'test3@example.com',
      passwordHash: existingHash
    });

    // Simulate an already-persisted document: mark passwordHash as unmodified.
    user.isModified = jest.fn().mockReturnValue(false);

    await User.schema.s.hooks.execPre('save', user, []);

    expect(user.passwordHash).toBe(existingHash);
  });
});
