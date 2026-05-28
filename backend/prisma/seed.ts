import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NaturaLodge database...');

  // ─── Room Features ────────────────────────────────────────────
  const features = await Promise.all([
    prisma.roomFeature.upsert({ where: { id: 'wifi' }, update: {}, create: { id: 'wifi', label: 'High-speed Wi-Fi', iconName: 'Wifi' } }),
    prisma.roomFeature.upsert({ where: { id: 'coffee' }, update: {}, create: { id: 'coffee', label: 'Organic Coffee Bar', iconName: 'Coffee' } }),
    prisma.roomFeature.upsert({ where: { id: 'ac' }, update: {}, create: { id: 'ac', label: 'Eco-Air Control', iconName: 'Wind' } }),
    prisma.roomFeature.upsert({ where: { id: 'tv' }, update: {}, create: { id: 'tv', label: 'Smart TV 4K', iconName: 'Tv' } }),
    prisma.roomFeature.upsert({ where: { id: 'entry' }, update: {}, create: { id: 'entry', label: 'Contactless Entry', iconName: 'ShieldCheck' } }),
    prisma.roomFeature.upsert({ where: { id: 'guide' }, update: {}, create: { id: 'guide', label: 'Curated Local Guide', iconName: 'Map' } }),
  ]);
  console.log(`✅ ${features.length} room features created`);

  // ─── Admin User ───────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@naturalodge.mg' },
    update: {},
    create: {
      email: 'admin@naturalodge.mg',
      password: adminPassword,
      name: 'Marie Dupont',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const receptionistPwd = await bcrypt.hash('Staff@1234', 12);
  const staff = await Promise.all([
    prisma.user.upsert({
      where: { email: 'sarah@naturalodge.mg' },
      update: {},
      create: { email: 'sarah@naturalodge.mg', password: receptionistPwd, name: 'Sarah L.', role: 'RECEPTIONIST', status: 'ACTIVE' },
    }),
    prisma.user.upsert({
      where: { email: 'jean@naturalodge.mg' },
      update: {},
      create: { email: 'jean@naturalodge.mg', password: receptionistPwd, name: 'Jean P.', role: 'HOUSEKEEPING', status: 'ACTIVE' },
    }),
    prisma.user.upsert({
      where: { email: 'marc@naturalodge.mg' },
      update: {},
      create: { email: 'marc@naturalodge.mg', password: receptionistPwd, name: 'Marc D.', role: 'MANAGER', status: 'ACTIVE' },
    }),
  ]);
  console.log(`✅ ${staff.length + 1} staff members created (admin: admin@naturalodge.mg / Admin@1234)`);

  // ─── Rooms ────────────────────────────────────────────────────
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { number: '101' },
      update: {},
      create: {
        number: '101', type: 'Natura Signature Suite', category: 'SUITE',
        area: 55, bedType: 'King Bed', capacity: '2 Guests', rate: 1500000,
        status: 'OCCUPIED', view: 'Garden View',
        description: '55sqm sanctuary with organic cotton bedding and an artisanal stone-clad bathroom.',
        features: { connect: [{ id: 'wifi' }, { id: 'coffee' }, { id: 'ac' }, { id: 'tv' }, { id: 'entry' }] },
      },
    }),
    prisma.room.upsert({
      where: { number: '402' },
      update: {},
      create: {
        number: '402', type: 'Deluxe Suite', category: 'SUITE',
        area: 74, bedType: 'King Size', capacity: '2 Adults, 1 Child', rate: 2000000,
        status: 'AVAILABLE', view: 'Ocean View',
        description: 'The Natura Suite blends contemporary elegance with tactile warmth.',
        features: { connect: [{ id: 'wifi' }, { id: 'coffee' }, { id: 'ac' }, { id: 'tv' }, { id: 'entry' }, { id: 'guide' }] },
      },
    }),
    prisma.room.upsert({
      where: { number: '105' },
      update: {},
      create: {
        number: '105', type: 'Garden Villa', category: 'VILLA',
        area: 120, bedType: 'King Bed', capacity: '4 Guests', rate: 5500000,
        status: 'OCCUPIED', view: 'Private Pool • Garden',
        description: 'A sprawling villa with a private garden and pool, offering ultimate privacy.',
        features: { connect: [{ id: 'wifi' }, { id: 'coffee' }, { id: 'ac' }, { id: 'tv' }, { id: 'entry' }, { id: 'guide' }] },
      },
    }),
    prisma.room.upsert({
      where: { number: '208' },
      update: {},
      create: {
        number: '208', type: 'Standard Room', category: 'SUPERIOR',
        area: 32, bedType: 'Single Bed', capacity: '1 Guest', rate: 600000,
        status: 'MAINTENANCE', view: 'Courtyard',
        description: 'A cozy standard room perfect for short stays.',
        features: { connect: [{ id: 'wifi' }, { id: 'tv' }] },
      },
    }),
  ]);
  console.log(`✅ ${rooms.length} rooms created`);

  // ─── Guests ───────────────────────────────────────────────────
  const guests = await Promise.all([
    prisma.guest.upsert({
      where: { email: 'elena.martin@outlook.com' },
      update: {},
      create: {
        name: 'Elena Martin', email: 'elena.martin@outlook.com',
        phone: '+33 6 45 32 11 00', address: 'Rue de la République, 69002',
        city: 'Lyon', country: 'France', status: 'VIP_ELITE',
        totalStays: 12, lifetimeValue: 42100000,
        preferences: ['Feather-free pillows', 'High floors', 'Organic Spa', 'Champagne Lover'],
        notes: {
          create: [
            { author: 'Sarah L.', role: 'Front Desk', content: 'Prefers chamomile tea on arrival. Birthday in November.' },
            { author: 'Jean P.', role: 'Housekeeping', content: 'Requested extra towels every morning at 9 AM.' },
          ],
        },
      },
    }),
    prisma.guest.upsert({
      where: { email: 'j.thorne@global-architects.com' },
      update: {},
      create: {
        name: 'Julian Thorne', email: 'j.thorne@global-architects.com',
        phone: '+44 7700 900342', address: 'Kensington, London',
        city: 'London', country: 'UK', status: 'PLATINUM_TIER',
        totalStays: 12, lifetimeValue: 62500000,
        preferences: ['Gluten Free', 'Black Coffee', 'High Floor', 'Extra Pillows'],
        notes: {
          create: [
            { author: 'Marc D.', role: 'Concierge', content: 'Guest celebrates 20th anniversary during the October stay.' },
          ],
        },
      },
    }),
  ]);
  console.log(`✅ ${guests.length} guests created`);

  // ─── Amenities ────────────────────────────────────────────────
  const amenities = await Promise.all([
    prisma.amenity.upsert({ where: { id: 'am-spa' }, update: {}, create: { id: 'am-spa', name: 'Organic Spa', category: 'Wellness', iconName: 'Sparkles', status: 'ACTIVE' } }),
    prisma.amenity.upsert({ where: { id: 'am-pool' }, update: {}, create: { id: 'am-pool', name: 'Infinity Pool', category: 'Recreation', iconName: 'Waves', status: 'ACTIVE' } }),
    prisma.amenity.upsert({ where: { id: 'am-rest' }, update: {}, create: { id: 'am-rest', name: 'Forest Restaurant', category: 'Dining', iconName: 'UtensilsCrossed', status: 'ACTIVE' } }),
    prisma.amenity.upsert({ where: { id: 'am-yoga' }, update: {}, create: { id: 'am-yoga', name: 'Yoga Pavilion', category: 'Wellness', iconName: 'Wind', status: 'ACTIVE' } }),
  ]);
  console.log(`✅ ${amenities.length} amenities created`);

  console.log('\n🏨 Seed completed successfully!');
  console.log('─────────────────────────────────');
  console.log('Admin login:');
  console.log('  Email    : admin@naturalodge.mg');
  console.log('  Password : Admin@1234');
  console.log('─────────────────────────────────');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
