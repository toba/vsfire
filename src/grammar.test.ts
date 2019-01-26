import '@toba/test';
import { findType, accessModifiers } from './grammar';

test('finds named TypeInfo', () => {
   ['math', 'document'].forEach(async name => {
      const info = await findType(name);
      expect(info).toBeDefined();
      expect(info).not.toBeNull();
      expect(info).toHaveProperty('methods');
   });
});

test('supports full and relative type paths', async () => {
   const t1 = await findType('token');
   const t2 = await findType('request.auth.token');

   expect(t1).toBeDefined();
   expect(t1).not.toBeNull();
   expect(t1).toHaveProperty('fields');
   expect(t1!.fields).toHaveProperty('phone_number');

   expect(t2).toBeDefined();
   expect(t1).toBe(t2);
});

test('applies basic type members to implementations', async () => {
   const info = await findType('request.time');

   expect(info).toBeDefined();
   expect(info).not.toBeNull();
   expect(info).toHaveProperty('methods');
   expect(info!.methods!['year']).toHaveProperty(
      'about',
      'The year value as an `int`, from 1 to 9999.'
   );
});

test('generates snippets for parameterized methods', async () => {
   const info = await findType('request.path');

   expect(info).toBeDefined();
   expect(info).not.toBeNull();
   expect(info).toHaveProperty('methods');
   expect(info!.methods!['split']).toHaveProperty(
      'snippet',
      'split(${1:regex})$0'
   );
   expect(info!.methods!['size']).toHaveProperty('snippet', 'size()$0');
});

test('builds list of request access methods', async () => {
   const methods = await accessModifiers();

   expect(methods).toBeDefined();
   expect(methods).toHaveLength(7);
});
