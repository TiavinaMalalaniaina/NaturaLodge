import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { seedChartOfAccounts } from './seedChartOfAccounts'
import { seedPermissions } from './seedPermissions'

config()

const sslDisabled = process.env.DATABASE_SSL === 'false' || process.env.DATABASE_URL?.includes('localhost')
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled ? false : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function noon(d: Date): Date {
  const r = new Date(d)
  r.setHours(14, 0, 0, 0)
  return r
}

const TODAY = noon(new Date())

// ─── Name & location pools ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Elena','Julian','Sofia','Marcus','Isabelle','Theo','Amara','Lucas','Priya','Olivier',
  'Yuki','Hassan','Chloe','Nour','Rafael','Astrid','Kwame','Mei','Luca','Fatima',
  'Andre','Ingrid','Tariq','Valeria','Soren','Aisha','Diego','Linnea','Omar','Celeste',
  'Hugo','Zara','Arjun','Freya','Mateus','Layla','Emil','Chiara','Remy','Sakura',
  'Kofi','Anya','Sebastien','Niamh','Alinta','Ezra','Mira','Tobias','Adaeze','Callum',
]
const LAST_NAMES = [
  'Martin','Thorne','Okonkwo','Ivanova','Nakamura','Leblanc','Al-Rashid','Santos','Berg','Osei',
  'Delacroix','Yamamoto','Mensah','Reyes','Lindqvist','Chakraborty','Fontaine','Amara','Kovac','Dubois',
  'Andersen','Ferreira','Otieno','Petrova','Hernandez','Johansson','Kabila','Russo','Nguyen','Fischer',
  'Diallo','Moreira','Tanaka','Eriksson','Balogun','Lefebvre','Kaur','Novak','Eze','Moreau',
]
const LOCATIONS = [
  { country: 'France',       city: 'Paris'     },
  { country: 'UK',           city: 'London'    },
  { country: 'Germany',      city: 'Berlin'    },
  { country: 'Italy',        city: 'Milan'     },
  { country: 'USA',          city: 'New York'  },
  { country: 'Japan',        city: 'Tokyo'     },
  { country: 'Brazil',       city: 'São Paulo' },
  { country: 'Australia',    city: 'Sydney'    },
  { country: 'Canada',       city: 'Toronto'   },
  { country: 'South Africa', city: 'Cape Town' },
  { country: 'Nigeria',      city: 'Lagos'     },
  { country: 'UAE',          city: 'Dubai'     },
  { country: 'Switzerland',  city: 'Geneva'    },
  { country: 'Sweden',       city: 'Stockholm' },
  { country: 'Norway',       city: 'Oslo'      },
]
const PREFS_POOL = [
  'High floors','Sea view','Feather-free pillows','Extra towels','Late checkout',
  'Early check-in','Champagne on arrival','Organic spa','Vegan menu','Gluten free',
  'Black coffee','Quiet room','King bed','Hypoallergenic bedding','Private pool',
  'Butler service','Airport transfer','Yoga mat','Mini bar stocked','Ocean view',
]
const GUEST_STATUSES = [
  'STANDARD','STANDARD','STANDARD','STANDARD',
  'VIP_MEMBER','VIP_MEMBER','VIP_ELITE','PLATINUM_TIER',
] as const

const BOOKING_NOTES = [
  'VIP guest — prepare welcome gift',
  'Anniversary stay — champagne requested',
  'Honeymoon — rose petals and turndown service',
  'Business traveler — late checkout needed',
  'Returning guest — prefers high floor',
  'Requires hypoallergenic bedding',
  'Infant in party — extra crib needed',
  'Celebrating birthday — special arrangement',
  'Long-stay guest — weekly laundry service',
  'Dietary restriction: vegetarian only',
  'Surprise proposal — coordinate with concierge',
  'Guest requested noise-free floor',
]

// ─── 4 Room Types ─────────────────────────────────────────────────────────────

const ROOM_TYPE_DEFS = [
  {
    key: 'SUP',
    name: 'Natura Superior',
    rate: 580_000,
    area: 32,
    bedType: 'Double',
    capacity: 2,
    view: 'Garden View',
    description: 'Cozy superior room nestled in lush greenery with garden view and premium eco amenities.',
    featureIds: ['wifi', 'tv'],
  },
  {
    key: 'DEL',
    name: 'Canopy Deluxe',
    rate: 980_000,
    area: 48,
    bedType: 'King Size',
    capacity: 2,
    view: 'Forest View',
    description: 'Elevated deluxe room with treetop views, private balcony and curated local guide service.',
    featureIds: ['wifi', 'coffee', 'ac', 'tv'],
  },
  {
    key: 'SUI',
    name: 'Lagoon Suite',
    rate: 1_750_000,
    area: 62,
    bedType: 'Super King',
    capacity: 3,
    view: 'Lagoon View',
    description: 'Spacious suite overlooking the private lagoon with butler service and outdoor soaking tub.',
    featureIds: ['wifi', 'coffee', 'ac', 'tv', 'entry'],
  },
  {
    key: 'PEN',
    name: 'Jungle Penthouse',
    rate: 3_800_000,
    area: 105,
    bedType: 'Super King',
    capacity: 4,
    view: 'Panoramic Jungle',
    description: 'Exclusive penthouse with 360° jungle panorama, private plunge pool and dedicated concierge.',
    featureIds: ['wifi', 'coffee', 'ac', 'tv', 'entry', 'guide'],
  },
]

// ─── 20 Rooms ─────────────────────────────────────────────────────────────────
//
// Role in the current period:
//   today (7)       → CONFIRMED arrival = TODAY  → DB status RESERVED
//   in_progress (10)→ CHECKED_IN since 1-4 days  → DB status OCCUPIED
//   maintenance (2) → no active booking           → DB status MAINTENANCE
//   available (1)   → no active booking           → DB status AVAILABLE

type RoomRole = 'today' | 'in_progress' | 'maintenance' | 'available'

const ROOM_DEFS: Array<{
  number: string
  typeKey: string
  role: RoomRole
  dbStatus: 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'AVAILABLE'
}> = [
  // Superior 101-105
  { number: '101', typeKey: 'SUP', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '102', typeKey: 'SUP', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '103', typeKey: 'SUP', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '104', typeKey: 'SUP', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '105', typeKey: 'SUP', role: 'maintenance', dbStatus: 'MAINTENANCE' },
  // Deluxe 201-205
  { number: '201', typeKey: 'DEL', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '202', typeKey: 'DEL', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '203', typeKey: 'DEL', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '204', typeKey: 'DEL', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '205', typeKey: 'DEL', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  // Suite 301-305
  { number: '301', typeKey: 'SUI', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '302', typeKey: 'SUI', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '303', typeKey: 'SUI', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '304', typeKey: 'SUI', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '305', typeKey: 'SUI', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  // Penthouse 401-405
  { number: '401', typeKey: 'PEN', role: 'today',       dbStatus: 'RESERVED'    },
  { number: '402', typeKey: 'PEN', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '403', typeKey: 'PEN', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '404', typeKey: 'PEN', role: 'maintenance', dbStatus: 'MAINTENANCE' },
  { number: '405', typeKey: 'PEN', role: 'available',   dbStatus: 'AVAILABLE'   },
]

// Fixed offsets so the seed is reproducible and realistic
const CHECKED_IN_ARRIVAL_OFFSET: Record<string, number> = {
  '103': 1, '104': 3,
  '203': 2, '204': 1, '205': 4,
  '303': 2, '304': 3, '305': 1,
  '402': 2, '403': 4,
}
const TODAY_DEP_OFFSET: Record<string, number> = {
  '101': 3, '102': 5,
  '201': 2, '202': 4,
  '301': 6, '302': 3,
  '401': 4,
}
const CHECKED_IN_DEP_OFFSET: Record<string, number> = {
  '103': 3, '104': 2,
  '203': 4, '204': 3, '205': 2,
  '303': 5, '304': 2, '305': 3,
  '402': 3, '403': 2,
}

// ─── Staff data ───────────────────────────────────────────────────────────────

const STAFF_DATA = [
  { email: 'admin@naturalodge.mg',     name: 'Marie Dupont',     role: 'ADMIN',        status: 'ACTIVE'   },
  { email: 'marc.d@naturalodge.mg',    name: 'Marc Delacroix',   role: 'MANAGER',      status: 'ACTIVE'   },
  { email: 'ines.f@naturalodge.mg',    name: 'Inès Fontaine',    role: 'MANAGER',      status: 'ACTIVE'   },
  { email: 'thomas.r@naturalodge.mg',  name: 'Thomas Renard',    role: 'MANAGER',      status: 'ON_LEAVE' },
  { email: 'sarah.l@naturalodge.mg',   name: 'Sarah Laurent',    role: 'RECEPTIONIST', status: 'ACTIVE'   },
  { email: 'camille.b@naturalodge.mg', name: 'Camille Bernard',  role: 'RECEPTIONIST', status: 'ACTIVE'   },
  { email: 'leo.m@naturalodge.mg',     name: 'Léo Martin',       role: 'RECEPTIONIST', status: 'ACTIVE'   },
  { email: 'nina.s@naturalodge.mg',    name: 'Nina Silva',       role: 'RECEPTIONIST', status: 'ACTIVE'   },
  { email: 'theo.k@naturalodge.mg',    name: 'Théo Kovac',       role: 'RECEPTIONIST', status: 'ACTIVE'   },
  { email: 'alice.n@naturalodge.mg',   name: 'Alice Nguyen',     role: 'RECEPTIONIST', status: 'ON_LEAVE' },
  { email: 'jean.p@naturalodge.mg',    name: 'Jean Petit',       role: 'HOUSEKEEPING', status: 'ACTIVE'   },
  { email: 'fatou.d@naturalodge.mg',   name: 'Fatou Diallo',     role: 'HOUSEKEEPING', status: 'ACTIVE'   },
  { email: 'carlos.m@naturalodge.mg',  name: 'Carlos Morales',   role: 'HOUSEKEEPING', status: 'ACTIVE'   },
  { email: 'yuki.t@naturalodge.mg',    name: 'Yuki Tanaka',      role: 'HOUSEKEEPING', status: 'ACTIVE'   },
  { email: 'amara.o@naturalodge.mg',   name: 'Amara Osei',       role: 'HOUSEKEEPING', status: 'INACTIVE' },
] as const

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await seedChartOfAccounts(prisma)
  await seedPermissions(prisma)

  // ── Room Features (upsert by fixed id) ────────────────────────────────────
  const featureDefs = [
    { id: 'wifi',   label: 'High-speed Wi-Fi',    iconName: 'Wifi'        },
    { id: 'coffee', label: 'Organic Coffee Bar',   iconName: 'Coffee'      },
    { id: 'ac',     label: 'Eco-Air Control',      iconName: 'Wind'        },
    { id: 'tv',     label: 'Smart TV 4K',          iconName: 'Tv'          },
    { id: 'entry',  label: 'Contactless Entry',    iconName: 'ShieldCheck' },
    { id: 'guide',  label: 'Curated Local Guide',  iconName: 'Map'         },
  ]
  for (const f of featureDefs) {
    await prisma.roomFeature.upsert({
      where:  { id: f.id },
      update: { label: f.label, iconName: f.iconName },
      create: f,
    })
  }
  console.log('✅ 6 room features')

  // ── Room Types (findFirst or create — name not @unique) ───────────────────
  const roomTypeIdByKey: Record<string, string> = {}
  for (const rt of ROOM_TYPE_DEFS) {
    let existing = await prisma.roomType.findFirst({ where: { name: rt.name } })
    if (!existing) {
      existing = await prisma.roomType.create({
        data: {
          name:        rt.name,
          rate:        rt.rate,
          area:        rt.area,
          bedType:     rt.bedType,
          capacity:    rt.capacity,
          view:        rt.view,
          description: rt.description,
          features:    { connect: rt.featureIds.map(id => ({ id })) },
        },
      })
    }
    roomTypeIdByKey[rt.key] = existing.id
  }
  console.log('✅ 4 room types')

  // ── Rooms (upsert by number @unique) ─────────────────────────────────────
  type RoomInfo = { id: string; rate: number; role: RoomRole }
  const roomByNumber: Record<string, RoomInfo> = {}

  for (const rd of ROOM_DEFS) {
    const typeDef = ROOM_TYPE_DEFS.find(t => t.key === rd.typeKey)!
    const room = await prisma.room.upsert({
      where:  { number: rd.number },
      update: {},
      create: {
        number:     rd.number,
        status:     rd.dbStatus,
        images:     [],
        roomTypeId: roomTypeIdByKey[rd.typeKey],
      },
    })
    roomByNumber[rd.number] = { id: room.id, rate: typeDef.rate, role: rd.role }
  }
  console.log('✅ 20 rooms')

  // ── Staff (upsert by username @unique — dérivé de la partie locale de l'email) ────────────
  const adminPwd = await bcrypt.hash('Admin@1234', 12)
  const staffPwd = await bcrypt.hash('Staff@1234', 12)

  const staff = await Promise.all(
    STAFF_DATA.map((s, i) => {
      const username = s.email.split('@')[0]
      return prisma.user.upsert({
        where:  { username },
        update: { name: s.name, role: s.role, status: s.status },
        create: {
          username,
          email:     s.email,
          name:      s.name,
          role:      s.role,
          status:    s.status,
          password:  i === 0 ? adminPwd : staffPwd,
          joinedDate: new Date(`${rand(2020, 2024)}-${String(rand(1, 12)).padStart(2, '0')}-01`),
        },
      })
    }),
  )
  console.log('✅ 15 staff')

  // ── Guests + Bookings : skip if already seeded ────────────────────────────
  const existingGuests = await prisma.guest.count()
  if (existingGuests > 0) {
    console.log(`⏭️  ${existingGuests} guests already exist — skipping guests & bookings`)
    console.log('\n🏨 Seed complete (partial)!')
    return
  }

  // ── Guests (100) ─────────────────────────────────────────────────────────
  const guests: Array<{ id: string }> = []
  for (let i = 0; i < 100; i++) {
    const first = pick(FIRST_NAMES)
    const last  = pick(LAST_NAMES)
    const loc   = pick(LOCATIONS)
    const stays = rand(0, 18)
    const prefs = Array.from(new Set(Array.from({ length: rand(0, 4) }, () => pick(PREFS_POOL))))
    const g = await prisma.guest.create({
      data: {
        name:          `${first} ${last}`,
        email:         `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
        phone:         `+${rand(1, 99)} ${rand(600, 799)} ${rand(100_000, 999_999)}`,
        city:          loc.city,
        country:       loc.country,
        status:        pick(GUEST_STATUSES),
        totalStays:    stays,
        lifetimeValue: stays * rand(600_000, 4_000_000),
        memberSince:   new Date(`${rand(2019, 2025)}-${String(rand(1, 12)).padStart(2, '0')}-01`),
        preferences:   prefs,
      },
    })
    guests.push({ id: g.id })
    if ((i + 1) % 25 === 0) process.stdout.write(`\r  guests: ${i + 1}/100`)
  }
  console.log('\n✅ 100 guests')

  // ── Build booking payloads ────────────────────────────────────────────────

  type BookingPayload = {
    guestId:     string
    createdById: string
    arrival:     Date
    departure:   Date
    status:      'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT_UNPAID' | 'CANCELLED'
    totalAmount: number
    notes:       string | null
    roomId:      string
    roomRate:    number
  }

  const allBookings: BookingPayload[] = []

  for (const [roomNumber, { id: roomId, rate, role }] of Object.entries(roomByNumber)) {

    // ── Maintenance rooms: a few historical stays only ───────────────────
    if (role === 'maintenance') {
      let c = noon(addDays(TODAY, -280))
      for (let i = 0; i < 4; i++) {
        const dur = rand(2, 5)
        const dep = noon(addDays(c, dur))
        allBookings.push({
          guestId:     pick(guests).id,
          createdById: pick(staff).id,
          arrival:     new Date(c),
          departure:   new Date(dep),
          status:      'CHECKED_OUT_UNPAID',
          totalAmount: rate * dur,
          notes:       null,
          roomId,
          roomRate:    rate,
        })
        c = noon(addDays(dep, rand(15, 35)))
      }
      continue
    }

    // ── Determine current-period boundaries ──────────────────────────────
    let currentArrival: Date
    let currentDeparture: Date
    let currentStatus: 'CONFIRMED' | 'CHECKED_IN'

    if (role === 'in_progress') {
      const arrOff = CHECKED_IN_ARRIVAL_OFFSET[roomNumber] ?? 2
      const depOff = CHECKED_IN_DEP_OFFSET[roomNumber]    ?? 3
      currentArrival   = noon(addDays(TODAY, -arrOff))
      currentDeparture = noon(addDays(TODAY, depOff))
      currentStatus    = 'CHECKED_IN'
    } else if (role === 'today') {
      const depOff     = TODAY_DEP_OFFSET[roomNumber] ?? 3
      currentArrival   = noon(new Date(TODAY))
      currentDeparture = noon(addDays(TODAY, depOff))
      currentStatus    = 'CONFIRMED'
    } else {
      // available — no current stay; just need sensible future start
      currentArrival   = noon(new Date(TODAY))
      currentDeparture = noon(new Date(TODAY))
      currentStatus    = 'CONFIRMED' // unused
    }

    // ── Past bookings (non-overlapping with current stay) ────────────────
    const pastCutoff = role === 'available'
      ? noon(addDays(TODAY, -14))
      : noon(addDays(currentArrival, -2))

    let cursor    = noon(addDays(TODAY, -(280 + rand(0, 30))))
    let pastCount = 0
    const MAX_PAST = 9

    while (cursor < pastCutoff && pastCount < MAX_PAST) {
      const dur = rand(2, 7)
      const dep = noon(addDays(cursor, dur))
      if (dep > pastCutoff) break

      const isCancelled = Math.random() < 0.17

      allBookings.push({
        guestId:     pick(guests).id,
        createdById: pick(staff).id,
        arrival:     new Date(cursor),
        departure:   new Date(dep),
        status:      isCancelled ? 'CANCELLED' : 'CHECKED_OUT_UNPAID',
        totalAmount: rate * dur,
        notes:       Math.random() < 0.25 ? pick(BOOKING_NOTES) : null,
        roomId,
        roomRate:    rate,
      })

      cursor = noon(addDays(dep, rand(10, 25)))
      pastCount++
    }

    // ── Current booking ───────────────────────────────────────────────────
    if (role !== 'available') {
      const nights = Math.round(
        (currentDeparture.getTime() - currentArrival.getTime()) / 86_400_000,
      )
      allBookings.push({
        guestId:     pick(guests).id,
        createdById: pick(staff).id,
        arrival:     new Date(currentArrival),
        departure:   new Date(currentDeparture),
        status:      currentStatus,
        totalAmount: rate * Math.max(1, nights),
        notes:       Math.random() < 0.45 ? pick(BOOKING_NOTES) : null,
        roomId,
        roomRate:    rate,
      })
    }

    // ── Future bookings (2-3 per room) ────────────────────────────────────
    let futCursor: Date
    if (role === 'available') {
      futCursor = noon(addDays(TODAY, rand(5, 15)))
    } else {
      futCursor = noon(addDays(currentDeparture, rand(7, 15)))
    }

    const futCount = rand(2, 4)
    for (let f = 0; f < futCount; f++) {
      const dur = rand(2, 7)
      const dep = noon(addDays(futCursor, dur))
      allBookings.push({
        guestId:     pick(guests).id,
        createdById: pick(staff).id,
        arrival:     new Date(futCursor),
        departure:   new Date(dep),
        status:      'CONFIRMED',
        totalAmount: rate * dur,
        notes:       Math.random() < 0.2 ? pick(BOOKING_NOTES) : null,
        roomId,
        roomRate:    rate,
      })
      futCursor = noon(addDays(dep, rand(8, 20)))
    }
  }

  // ── Insert bookings in parallel chunks ────────────────────────────────────
  const CHUNK = 15
  let inserted = 0

  for (let i = 0; i < allBookings.length; i += CHUNK) {
    const slice = allBookings.slice(i, i + CHUNK)
    await Promise.all(
      slice.map(b =>
        prisma.booking.create({
          data: {
            guestId:     b.guestId,
            createdById: b.createdById,
            arrival:     b.arrival,
            departure:   b.departure,
            status:      b.status,
            totalAmount: b.totalAmount,
            notes:       b.notes,
            rooms: {
              create: [{
                roomId:   b.roomId,
                arrival:  b.arrival,
                departure: b.departure,
                roomRate: b.roomRate,
              }],
            },
          },
        }),
      ),
    )
    inserted += slice.length
    process.stdout.write(`\r  bookings: ${inserted}/${allBookings.length}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = allBookings.reduce(
    (acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc },
    {} as Record<string, number>,
  )

  console.log(`\n✅ ${allBookings.length} bookings total`)
  console.log(`   CHECKED_OUT_UNPAID: ${counts.CHECKED_OUT_UNPAID ?? 0}`)
  console.log(`   CHECKED_IN:  ${counts.CHECKED_IN  ?? 0}  (today: in progress)`)
  console.log(`   CONFIRMED:   ${counts.CONFIRMED   ?? 0}  (incl. 7 arriving today)`)
  console.log(`   CANCELLED:   ${counts.CANCELLED   ?? 0}`)

  console.log('\n🏨 Seed complete (full)!')
  console.log('─────────────────────────────────────────────────────')
  console.log('  ADMIN       admin@naturalodge.mg   / Admin@1234')
  console.log('  MANAGER     marc.d@naturalodge.mg  / Staff@1234')
  console.log('  RECEPTIONIST sarah.l@naturalodge.mg / Staff@1234')
  console.log('─────────────────────────────────────────────────────')
  console.log('  Rooms arriving TODAY: 101 102 201 202 301 302 401')
  console.log('  Rooms CHECKED_IN    : 103 104 203 204 205 303 304 305 402 403')
  console.log('  Rooms MAINTENANCE   : 105 404')
  console.log('─────────────────────────────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await pool.end(); await prisma.$disconnect() })
