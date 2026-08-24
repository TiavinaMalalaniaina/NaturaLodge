import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { config } from 'dotenv'
import { seedChartOfAccounts } from './seedChartOfAccounts'

config()

// Seed minimal pour une base neuve (prod) : crée uniquement le premier compte ADMIN, pour que
// quelqu'un puisse se connecter et construire le reste (types de chambre, chambres, suppléments,
// staff, clients) via l'interface, qui a déjà tout le CRUD nécessaire. Contrairement à seed.ts
// (démo), aucune donnée factice n'est générée.

const sslDisabled = process.env.DATABASE_SSL === 'false' || process.env.DATABASE_URL?.includes('localhost')
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled ? false : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

function generatePassword(length = 16): string {
  // Alphabet sans caractères ambigus (0/O, 1/l/I).
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from(crypto.randomBytes(length), (b) => chars[b % chars.length]).join('')
}

async function main() {
  await seedChartOfAccounts(prisma)

  const username = process.env.INIT_ADMIN_USERNAME ?? 'admin'
  const email    = process.env.INIT_ADMIN_EMAIL
  const password = process.env.INIT_ADMIN_PASSWORD ?? generatePassword()

  const existing = await prisma.user.findUnique({ where: { username } })
  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where:  { username },
    update: {},
    create: {
      username,
      email:    email ?? null,
      name:     'Administrateur',
      role:     'ADMIN',
      status:   'ACTIVE',
      password: hashed,
    },
  })

  console.log('─────────────────────────────────────────────────────')
  if (existing) {
    console.log(`✅ Compte ADMIN "${username}" existe déjà — aucune modification.`)
  } else {
    console.log('✅ Compte ADMIN créé.')
    console.log(`   username : ${username}`)
    console.log(`   password : ${password}`)
    console.log("   ⚠️  Ce mot de passe ne sera plus jamais affiché — change-le dès la première connexion.")
  }
  console.log('─────────────────────────────────────────────────────')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
