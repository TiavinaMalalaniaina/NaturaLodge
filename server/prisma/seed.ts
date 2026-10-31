import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { seedChartOfAccounts } from './seedChartOfAccounts'
import { seedExpenseCategories } from './seedExpenseCategories'
import { seedRoles } from './seedRoles'
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

// ─── Room Types — calqués sur la base de prod actuelle (2 types, sans features) ────────────────

const ROOM_TYPE_DEFS = [
  {
    key: 'STD',
    name: 'Standard',
    rate: 130_000,
    area: 30,
    bedType: 'King Size',
    capacity: 5,
    view: 'Garden View',
    description: '',
  },
  {
    key: 'SUP',
    name: 'Standard Sup',
    rate: 150_000,
    area: 30,
    bedType: 'King Size',
    capacity: 6,
    view: 'Garden View',
    description: '',
  },
]

// ─── 8 Rooms — noms et statuts calqués sur la base de prod actuelle ───────────────────────────
//
//   in_progress (2) → CHECKED_IN en cours       → DB status OCCUPIED
//   maintenance (3) → séjours passés uniquement → DB status MAINTENANCE
//   available   (3) → passé + futur, pas de séjour en cours → DB status AVAILABLE
//
// `number` = "<numéro>-<nom de fleur>" comme en base (ex. "101-Azalée"). "Gironflier" reprend
// l'orthographe (fautive) de la base.

type RoomRole = 'in_progress' | 'maintenance' | 'available'

const ROOM_DEFS: Array<{
  number: string
  typeKey: string
  role: RoomRole
  dbStatus: 'OCCUPIED' | 'MAINTENANCE' | 'AVAILABLE'
}> = [
  { number: '101-Azalée',     typeKey: 'STD', role: 'available',   dbStatus: 'AVAILABLE'   },
  { number: '102-Bambou',     typeKey: 'STD', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '301-Eucalyptus', typeKey: 'STD', role: 'maintenance', dbStatus: 'MAINTENANCE' },
  { number: '302-Fougère',    typeKey: 'STD', role: 'maintenance', dbStatus: 'MAINTENANCE' },
  { number: '201-Canelle',    typeKey: 'SUP', role: 'available',   dbStatus: 'AVAILABLE'   },
  { number: '202-Dombeya',    typeKey: 'SUP', role: 'in_progress', dbStatus: 'OCCUPIED'    },
  { number: '401-Gironflier', typeKey: 'SUP', role: 'available',   dbStatus: 'AVAILABLE'   },
  { number: '402-Hibiscus',   typeKey: 'SUP', role: 'maintenance', dbStatus: 'MAINTENANCE' },
]

// Fenêtre des données de démo : réservations d'août à début octobre 2026 (comme la base actuelle).
const WINDOW_START = noon(new Date('2026-08-01'))
const WINDOW_END   = noon(new Date('2026-10-05'))
const GUEST_COUNT  = 49

// ─── Staff data ───────────────────────────────────────────────────────────────

// Utilisateurs calqués sur la base de prod actuelle. `username` = partie locale de l'email.
const STAFF_DATA = [
  { email: 'admin@naturalodge.mg',               name: 'Administrateur',                    role: 'ADMIN',   status: 'ACTIVE' },
  { email: 'tiavinamalalaniaina@naturalodge.mg', name: 'Tiavina Malalaniaina RAMIANDRISOA', role: 'ADMIN',   status: 'ACTIVE' },
  { email: 'felanaramia@naturalodge.mg',         name: 'Felana RAMIANDRISOA',               role: 'MANAGER', status: 'ACTIVE' },
  { email: 'sahondra@naturalodge.mg',            name: 'Sahondra RAKOTOMALALA',             role: 'MANAGER', status: 'ACTIVE' },
  { email: 'tovo@naturalodge.mg',                name: 'Tovoniaina RAMIANDRISOA',           role: 'MANAGER', status: 'ACTIVE' },
  { email: 'gerant@naturalodge.mg',              name: 'gerant',                            role: 'GERANT',  status: 'ACTIVE' },
  { email: 'manuella@naturalodge.mg',            name: 'Manuëlla',                          role: 'GERANT',  status: 'ACTIVE' },
] as const

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await seedChartOfAccounts(prisma)
  await seedExpenseCategories(prisma)
  await seedRoles(prisma)
  await seedPermissions(prisma)

  // ── Room Types (findFirst or create — name not @unique) — sans features, comme en base ────
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
        },
      })
    }
    roomTypeIdByKey[rt.key] = existing.id
  }
  console.log(`✅ ${ROOM_TYPE_DEFS.length} room types`)

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
  console.log(`✅ ${ROOM_DEFS.length} rooms`)

  // ── Staff (upsert by username @unique — dérivé de la partie locale de l'email) ────────────
  const adminPwd = await bcrypt.hash('Admin@1234', 12)
  const staffPwd = await bcrypt.hash('Staff@1234', 12)

  const roles = await prisma.role.findMany({ select: { id: true, name: true } })
  const roleIdByName = new Map(roles.map(r => [r.name, r.id]))

  const staff = await Promise.all(
    STAFF_DATA.map((s, i) => {
      const username = s.email.split('@')[0]
      const roleId = roleIdByName.get(s.role)!
      return prisma.user.upsert({
        where:  { username },
        update: { name: s.name, roleId, status: s.status },
        create: {
          username,
          email:     s.email,
          name:      s.name,
          roleId,
          status:    s.status,
          password:  i === 0 ? adminPwd : staffPwd,
          joinedDate: new Date(`${rand(2020, 2024)}-${String(rand(1, 12)).padStart(2, '0')}-01`),
        },
      })
    }),
  )
  console.log(`✅ ${STAFF_DATA.length} staff`)

  // ── Guests + Bookings : skip if already seeded ────────────────────────────
  const existingGuests = await prisma.guest.count()
  if (existingGuests > 0) {
    console.log(`⏭️  ${existingGuests} guests already exist — skipping guests & bookings`)
    console.log('\n🏨 Seed complete (partial)!')
    return
  }

  // ── Guests ──────────────────────────────────────────────────────────────
  const guests: Array<{ id: string }> = []
  for (let i = 0; i < GUEST_COUNT; i++) {
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
    if ((i + 1) % 25 === 0) process.stdout.write(`\r  guests: ${i + 1}/${GUEST_COUNT}`)
  }
  console.log(`\n✅ ${GUEST_COUNT} guests`)

  // ── Build booking payloads — fenêtre WINDOW_START → WINDOW_END, calquée sur la base actuelle ──
  //   available   : séjours passés + 1-2 futurs
  //   in_progress : séjours passés + 1 séjour CHECKED_IN en cours + 1-2 futurs
  //   maintenance : séjours passés uniquement (chambre hors service depuis)

  type BookingPayload = {
    guestId:     string
    createdById: string
    arrival:     Date
    departure:   Date
    status:      'CONFIRMED' | 'CHECKED_IN' | 'AWAITING' | 'CHECKED_OUT_UNPAID' | 'CANCELLED'
    totalAmount: number
    notes:       string | null
    roomId:      string
    roomRate:    number
  }

  const allBookings: BookingPayload[] = []
  const nights = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000))

  for (const { id: roomId, rate, role } of Object.values(roomByNumber)) {

    // Séjour en cours (in_progress seulement)
    const currentArrival   = role === 'in_progress' ? noon(addDays(TODAY, -rand(1, 4))) : null
    const currentDeparture = role === 'in_progress' ? noon(addDays(TODAY, rand(2, 5)))  : null

    // ── Passé : d'août jusqu'à la veille du séjour en cours (ou TODAY - 3j), borné à la fenêtre ──
    const pastCutoff = currentArrival ? noon(addDays(currentArrival, -2)) : noon(addDays(TODAY, -3))
    const pastEnd    = pastCutoff < WINDOW_END ? pastCutoff : WINDOW_END
    let cursor = noon(addDays(WINDOW_START, rand(0, 5)))
    for (let n = 0; n < 8; n++) {
      const dep = noon(addDays(cursor, rand(2, 5)))
      if (dep >= pastEnd) break
      allBookings.push({
        guestId:     pick(guests).id,
        createdById: pick(staff).id,
        arrival:     new Date(cursor),
        departure:   new Date(dep),
        status:      Math.random() < 0.18 ? 'CANCELLED' : 'CHECKED_OUT_UNPAID',
        totalAmount: rate * nights(cursor, dep),
        notes:       Math.random() < 0.25 ? pick(BOOKING_NOTES) : null,
        roomId,
        roomRate:    rate,
      })
      cursor = noon(addDays(dep, rand(2, 7)))
    }

    // ── Séjour en cours ──
    if (currentArrival && currentDeparture) {
      allBookings.push({
        guestId:     pick(guests).id,
        createdById: pick(staff).id,
        arrival:     new Date(currentArrival),
        departure:   new Date(currentDeparture),
        status:      'CHECKED_IN',
        totalAmount: rate * nights(currentArrival, currentDeparture),
        notes:       Math.random() < 0.4 ? pick(BOOKING_NOTES) : null,
        roomId,
        roomRate:    rate,
      })
    }

    // ── Futur : 1-2 par chambre, dans la fenêtre ──
    if (role !== 'maintenance') {
      let futCursor = noon(addDays(currentDeparture ?? TODAY, rand(3, 10)))
      const futCount = rand(1, 2)
      for (let f = 0; f < futCount; f++) {
        const dep = noon(addDays(futCursor, rand(2, 5)))
        if (dep > WINDOW_END) break
        allBookings.push({
          guestId:     pick(guests).id,
          createdById: pick(staff).id,
          arrival:     new Date(futCursor),
          departure:   new Date(dep),
          status:      Math.random() < 0.12 ? 'AWAITING' : 'CONFIRMED',
          totalAmount: rate * nights(futCursor, dep),
          notes:       Math.random() < 0.15 ? pick(BOOKING_NOTES) : null,
          roomId,
          roomRate:    rate,
        })
        futCursor = noon(addDays(dep, rand(4, 12)))
      }
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
  console.log(`   CHECKED_IN:         ${counts.CHECKED_IN         ?? 0}  (séjours en cours)`)
  console.log(`   CONFIRMED:          ${counts.CONFIRMED          ?? 0}`)
  console.log(`   AWAITING:           ${counts.AWAITING           ?? 0}`)
  console.log(`   CANCELLED:          ${counts.CANCELLED          ?? 0}`)

  console.log('\n🏨 Seed complete (full)!')
  console.log('─────────────────────────────────────────────────────')
  console.log('  ADMIN    admin@naturalodge.mg   / Admin@1234')
  console.log('  MANAGER  felanaramia@naturalodge.mg / Staff@1234')
  console.log('  GERANT   gerant@naturalodge.mg  / Staff@1234')
  console.log('─────────────────────────────────────────────────────')
  console.log('  OCCUPIED    : 102-Bambou 202-Dombeya')
  console.log('  MAINTENANCE : 301-Eucalyptus 302-Fougère 402-Hibiscus')
  console.log('  AVAILABLE   : 101-Azalée 201-Canelle 401-Gironflier')
  console.log('─────────────────────────────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await pool.end(); await prisma.$disconnect() })
