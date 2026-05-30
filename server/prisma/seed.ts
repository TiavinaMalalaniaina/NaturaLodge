import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─── Helpers ──────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ─── Data pools ───────────────────────────────────────────────────

const FIRST_NAMES = [
  'Elena','Julian','Sofia','Marcus','Isabelle','Theo','Amara','Lucas','Priya','Olivier',
  'Yuki','Hassan','Chloe','Nour','Rafael','Astrid','Kwame','Mei','Luca','Fatima',
  'Andre','Ingrid','Tariq','Valeria','Soren','Aisha','Diego','Linnea','Omar','Celeste',
  'Hugo','Zara','Arjun','Freya','Mateus','Layla','Emil','Chiara','Remy','Sakura',
  'Kofi','Anya','Sebastien','Niamh','Alinta','Ezra','Mira','Tobias','Adaeze','Callum',
  'Leila','Finn','Amina','Dante','Sigrid','Cyrus','Hana','Leo','Roxanne','Idris',
  'Petra','Flynn','Ines','Emeka','Solange','Nico','Zoe','Kaspar','Yemi','Billie',
  'Orion','Sasha','Naveen','Elodie','Thabo','Iris','Marco','Aaliya','Declan','Nadia',
  'Claude','Yara','Matteo','Tanaka','Linh','Stellan','Kenji','Vivienne','Kwesi','Aurora',
  'Bernard','Malia','Crispin','Soraya','Tomas','Bea','Alistair','Kemi','Rupert','Seun',
]

const LAST_NAMES = [
  'Martin','Thorne','Okonkwo','Ivanova','Nakamura','Leblanc','Al-Rashid','Santos','Berg','Osei',
  'Delacroix','Yamamoto','Mensah','Reyes','Lindqvist','Chakraborty','Fontaine','Amara','Kovac','Dubois',
  'Andersen','Ferreira','Otieno','Petrova','Hernandez','Johansson','Kabila','Russo','Nguyen','Fischer',
  'Diallo','Moreira','Tanaka','Eriksson','Balogun','Lefebvre','Kaur','Novak','Eze','Moreau',
  'Svensson','Almeida','Oduya','Bergstrom','Calderon','Nkosi','Lambert','Hashimoto','Souza','Weber',
  'Abara','Persson','Villanueva','Olsson','Takahashi','Ribeiro','Adekunle','Laurent','Nakagawa','Schmidt',
  'Abioye','Nilsson','Castillo','Holm','Watanabe','Carvalho','Adeyemi','Rousseau','Miyamoto','Koch',
]

const LOCATIONS = [
  { country: 'France',       city: 'Paris'      },
  { country: 'UK',           city: 'London'     },
  { country: 'Germany',      city: 'Berlin'     },
  { country: 'Italy',        city: 'Milan'      },
  { country: 'USA',          city: 'New York'   },
  { country: 'Japan',        city: 'Tokyo'      },
  { country: 'Brazil',       city: 'São Paulo'  },
  { country: 'Australia',    city: 'Sydney'     },
  { country: 'Canada',       city: 'Toronto'    },
  { country: 'South Africa', city: 'Cape Town'  },
  { country: 'Nigeria',      city: 'Lagos'      },
  { country: 'UAE',          city: 'Dubai'      },
  { country: 'Singapore',    city: 'Singapore'  },
  { country: 'India',        city: 'Mumbai'     },
  { country: 'Spain',        city: 'Barcelona'  },
  { country: 'Netherlands',  city: 'Amsterdam'  },
  { country: 'Switzerland',  city: 'Geneva'     },
  { country: 'Sweden',       city: 'Stockholm'  },
  { country: 'Norway',       city: 'Oslo'       },
  { country: 'Kenya',        city: 'Nairobi'    },
]

const STATUSES    = ['STANDARD','STANDARD','STANDARD','STANDARD','VIP_MEMBER','VIP_MEMBER','VIP_ELITE','PLATINUM_TIER']
const PREFS_POOL  = [
  'High floors','Sea view','Feather-free pillows','Extra towels','Late checkout',
  'Early check-in','Champagne on arrival','Organic spa','Vegan menu','Gluten free',
  'Black coffee','Quiet room','King bed','Hypoallergenic bedding','Private pool',
  'Butler service','Airport transfer','Yoga mat','Mini bar stocked','Ocean view',
]

// ─── 30 Rooms ─────────────────────────────────────────────────────

const ROOMS_DATA = [
  { number:'101', type:'Natura Signature Suite',  category:'SUITE',     area:55,  bedType:'King Bed',       capacity:2, rate:1500000, view:'Garden View',           status:'OCCUPIED'    },
  { number:'102', type:'Forest Deluxe',           category:'DELUXE',    area:42,  bedType:'King Size',      capacity:2, rate:900000,  view:'Forest View',           status:'AVAILABLE'   },
  { number:'103', type:'Riverstone Superior',     category:'SUPERIOR',  area:32,  bedType:'Double',         capacity:2, rate:600000,  view:'Courtyard',             status:'AVAILABLE'   },
  { number:'104', type:'Jungle Penthouse',        category:'PENTHOUSE', area:95,  bedType:'Super King',     capacity:3, rate:3500000, view:'Panoramic Jungle',      status:'AVAILABLE'   },
  { number:'105', type:'Garden Villa',            category:'VILLA',     area:120, bedType:'King Bed',       capacity:4, rate:5500000, view:'Private Pool · Garden', status:'OCCUPIED'    },
  { number:'106', type:'Bamboo Superior',         category:'SUPERIOR',  area:30,  bedType:'Twin Signature', capacity:2, rate:550000,  view:'Garden View',           status:'AVAILABLE'   },
  { number:'107', type:'Canopy Deluxe',           category:'DELUXE',    area:48,  bedType:'King Size',      capacity:2, rate:1100000, view:'Treetop View',          status:'RESERVED'    },
  { number:'108', type:'Lagoon Suite',            category:'SUITE',     area:65,  bedType:'Super King',     capacity:2, rate:1800000, view:'Lagoon View',           status:'AVAILABLE'   },
  { number:'109', type:'Heritage Luxury Room',    category:'LUXURY',    area:78,  bedType:'King Bed',       capacity:2, rate:2400000, view:'Valley View',           status:'AVAILABLE'   },
  { number:'110', type:'Treehouse Suite',         category:'SUITE',     area:70,  bedType:'King Bed',       capacity:2, rate:2000000, view:'Canopy View',           status:'MAINTENANCE' },
  { number:'201', type:'Savanna Superior',        category:'SUPERIOR',  area:35,  bedType:'Double',         capacity:2, rate:620000,  view:'Garden View',           status:'AVAILABLE'   },
  { number:'202', type:'Orchid Deluxe',           category:'DELUXE',    area:45,  bedType:'King Size',      capacity:2, rate:980000,  view:'Pool View',             status:'AVAILABLE'   },
  { number:'203', type:'Rainforest Suite',        category:'SUITE',     area:60,  bedType:'Super King',     capacity:3, rate:1700000, view:'Rainforest View',       status:'AVAILABLE'   },
  { number:'204', type:'Baobab Penthouse',        category:'PENTHOUSE', area:100, bedType:'Super King',     capacity:3, rate:3800000, view:'360° Panorama',         status:'AVAILABLE'   },
  { number:'205', type:'Coral Luxury Room',       category:'LUXURY',    area:82,  bedType:'King Bed',       capacity:2, rate:2600000, view:'Ocean View',            status:'RESERVED'    },
  { number:'206', type:'Papyrus Superior',        category:'SUPERIOR',  area:33,  bedType:'Twin Signature', capacity:2, rate:580000,  view:'Courtyard',             status:'AVAILABLE'   },
  { number:'207', type:'Lotus Deluxe',            category:'DELUXE',    area:50,  bedType:'King Size',      capacity:2, rate:1050000, view:'Garden View',           status:'AVAILABLE'   },
  { number:'208', type:'Terrace Suite',           category:'SUITE',     area:58,  bedType:'King Bed',       capacity:2, rate:1600000, view:'Terrace · Valley',      status:'AVAILABLE'   },
  { number:'301', type:'Mangrove Superior',       category:'SUPERIOR',  area:31,  bedType:'Double',         capacity:2, rate:560000,  view:'Garden View',           status:'AVAILABLE'   },
  { number:'302', type:'Amber Deluxe',            category:'DELUXE',    area:46,  bedType:'King Size',      capacity:2, rate:1000000, view:'Valley View',           status:'AVAILABLE'   },
  { number:'303', type:'Silk Road Suite',         category:'SUITE',     area:62,  bedType:'Super King',     capacity:2, rate:1750000, view:'Mountain View',         status:'MAINTENANCE' },
  { number:'304', type:'Horizon Luxury',          category:'LUXURY',    area:80,  bedType:'King Bed',       capacity:2, rate:2500000, view:'Horizon View',          status:'AVAILABLE'   },
  { number:'305', type:'Ebony Penthouse',         category:'PENTHOUSE', area:110, bedType:'Super King',     capacity:4, rate:4200000, view:'Private Terrace · Sea', status:'AVAILABLE'   },
  { number:'306', type:'Fern Deluxe',             category:'DELUXE',    area:44,  bedType:'King Size',      capacity:2, rate:920000,  view:'Forest View',           status:'AVAILABLE'   },
  { number:'401', type:'Sunset Superior',         category:'SUPERIOR',  area:34,  bedType:'Double',         capacity:2, rate:600000,  view:'Sunset View',           status:'AVAILABLE'   },
  { number:'402', type:'Deluxe Suite',            category:'SUITE',     area:74,  bedType:'King Size',      capacity:3, rate:2000000, view:'Ocean View',            status:'AVAILABLE'   },
  { number:'403', type:'Volcano Luxury',          category:'LUXURY',    area:85,  bedType:'King Bed',       capacity:2, rate:2700000, view:'Volcano View',          status:'AVAILABLE'   },
  { number:'404', type:'Grande Penthouse',        category:'PENTHOUSE', area:130, bedType:'Super King',     capacity:4, rate:4800000, view:'Full Ocean Panorama',   status:'RESERVED'    },
  { number:'405', type:'Moss Villa',              category:'VILLA',     area:140, bedType:'King Bed',       capacity:6, rate:6500000, view:'Private Garden · Pool', status:'AVAILABLE'   },
  { number:'406', type:'Serenity Deluxe',         category:'DELUXE',    area:47,  bedType:'King Size',      capacity:2, rate:950000,  view:'Pool View',             status:'AVAILABLE'   },
]

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('🗑️  Clearing database...')

  // Delete in FK-safe order (children before parents)
  await prisma.payment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.guestNote.deleteMany()
  await prisma.bookingRoom.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.room.deleteMany()
  await prisma.roomFeature.deleteMany()
  await prisma.guest.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Database cleared\n🌱 Seeding...')

  // ─── Room Features ──────────────────────────────────────────
  await prisma.roomFeature.createMany({
    data: [
      { id: 'wifi',   label: 'High-speed Wi-Fi',    iconName: 'Wifi'        },
      { id: 'coffee', label: 'Organic Coffee Bar',   iconName: 'Coffee'      },
      { id: 'ac',     label: 'Eco-Air Control',      iconName: 'Wind'        },
      { id: 'tv',     label: 'Smart TV 4K',          iconName: 'Tv'          },
      { id: 'entry',  label: 'Contactless Entry',    iconName: 'ShieldCheck' },
      { id: 'guide',  label: 'Curated Local Guide',  iconName: 'Map'         },
    ],
  })
  console.log('✅ 6 room features')

  // ─── Staff ──────────────────────────────────────────────────
  const adminPwd = await bcrypt.hash('Admin@1234', 12)
  const staffPwd = await bcrypt.hash('Staff@1234', 12)

  const [admin, sarah, jean, marc] = await Promise.all([
    prisma.user.create({ data: { email: 'admin@naturalodge.mg', password: adminPwd, name: 'Marie Dupont', role: 'ADMIN',        status: 'ACTIVE' } }),
    prisma.user.create({ data: { email: 'sarah@naturalodge.mg', password: staffPwd, name: 'Sarah L.',     role: 'RECEPTIONIST', status: 'ACTIVE' } }),
    prisma.user.create({ data: { email: 'jean@naturalodge.mg',  password: staffPwd, name: 'Jean P.',      role: 'HOUSEKEEPING', status: 'ACTIVE' } }),
    prisma.user.create({ data: { email: 'marc@naturalodge.mg',  password: staffPwd, name: 'Marc D.',      role: 'MANAGER',      status: 'ACTIVE' } }),
  ])
  void admin; void jean
  console.log('✅ 4 staff members')

  // ─── 30 Rooms ───────────────────────────────────────────────
  const featureSets = [
    ['wifi','tv'],
    ['wifi','coffee','ac'],
    ['wifi','coffee','ac','tv'],
    ['wifi','coffee','ac','tv','entry'],
    ['wifi','coffee','ac','tv','entry','guide'],
  ]

  const rooms = await Promise.all(
    ROOMS_DATA.map(r => prisma.room.create({
      data: {
        number:      r.number,
        type:        r.type,
        category:    r.category as any,
        area:        r.area,
        bedType:     r.bedType,
        capacity:    r.capacity,
        rate:        r.rate,
        view:        r.view,
        status:      r.status as any,
        images:      [],
        description: `${r.type} — ${r.area}m² with ${r.view.toLowerCase()}.`,
        features:    { connect: pick(featureSets).map(id => ({ id })) },
      },
    }))
  )
  console.log(`✅ ${rooms.length} rooms`)

  // ─── 1000 Guests ────────────────────────────────────────────
  const BATCH = 50
  for (let i = 0; i < 1000; i++) {
    const first = pick(FIRST_NAMES)
    const last  = pick(LAST_NAMES)
    const loc   = pick(LOCATIONS)
    const stays = rand(0, 24)
    const prefs = Array.from(
      new Set(Array.from({ length: rand(0, 4) }, () => pick(PREFS_POOL)))
    )

    await prisma.guest.create({
      data: {
        name:          `${first} ${last}`,
        email:         `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
        phone:         `+${rand(1,99)} ${rand(600,799)} ${rand(100000,999999)}`,
        city:          loc.city,
        country:       loc.country,
        status:        pick(STATUSES) as any,
        totalStays:    stays,
        lifetimeValue: stays * rand(600000, 5000000),
        memberSince:   new Date(`${rand(2018,2025)}-${String(rand(1,12)).padStart(2,'0')}-01`),
        preferences:   prefs,
      },
    })
    if ((i + 1) % BATCH === 0) process.stdout.write(`\r  guests: ${i + 1}/1000`)
  }
  console.log('\n✅ 1000 guests')

  // ─── Sample bookings / invoice / payment / notes ─────────────
  const [g1, g2] = await prisma.guest.findMany({ take: 2, orderBy: { createdAt: 'asc' } })
  const r101 = rooms.find(r => r.number === '101')!
  const r402 = rooms.find(r => r.number === '402')!
  const r105 = rooms.find(r => r.number === '105')!

  await prisma.booking.create({
    data: {
      guestId: g1.id, createdById: sarah.id,
      arrival: new Date('2026-06-01'), departure: new Date('2026-06-05'),
      status: 'CONFIRMED', totalAmount: 14000000,
      rooms: { create: [
        { roomId: r101.id, arrival: new Date('2026-06-01'), departure: new Date('2026-06-05'), roomRate: r101.rate },
        { roomId: r402.id, arrival: new Date('2026-06-01'), departure: new Date('2026-06-05'), roomRate: r402.rate },
      ]},
    },
  })

  const bookingJulian = await prisma.booking.create({
    data: {
      guestId: g2.id, createdById: sarah.id,
      arrival: new Date('2026-06-10'), departure: new Date('2026-06-15'),
      status: 'CHECKED_IN', totalAmount: 27500000,
      rooms: { create: [
        { roomId: r105.id, arrival: new Date('2026-06-10'), departure: new Date('2026-06-15'), roomRate: r105.rate },
      ]},
    },
  })

  const invoice = await prisma.invoice.create({
    data: {
      number: 'INV-2026-001', bookingId: bookingJulian.id,
      guestId: g2.id, issuedById: marc.id,
      status: 'PAID', paidAt: new Date(),
      totalAmount: 28875000, taxAmount: 1375000,
      items: { create: [
        { description: 'Garden Villa — 5 nuits', quantity: 5, unitPrice: r105.rate, total: 5 * r105.rate },
        { description: 'TVA 5%',                 quantity: 1, unitPrice: 1375000,   total: 1375000       },
      ]},
    },
  })

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id, processedById: sarah.id,
      amount: 28875000, method: 'CARD', status: 'COMPLETED',
      reference: 'TXN-20260610-7742',
    },
  })

  await prisma.guestNote.createMany({ data: [
    { guestId: g1.id, authorId: sarah.id, content: 'Prefers chamomile tea on arrival. Birthday in November.' },
    { guestId: g2.id, authorId: marc.id,  content: 'Guest celebrates 20th anniversary during the October stay.' },
  ]})

  console.log('✅ 2 bookings, 1 invoice, 1 payment, 2 notes')

  console.log('\n🏨 Seed completed!')
  console.log('─────────────────────────────')
  console.log('  admin@naturalodge.mg / Admin@1234')
  console.log('─────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await pool.end(); await prisma.$disconnect() })
