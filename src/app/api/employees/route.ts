import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { listEmployees, createEmployee } from '@/lib/repositories/employees'

const CreateSchema = z.object({
  full_name:       z.string().min(1).max(120),
  nickname:        z.string().max(60).optional(),
  role:            z.string().min(1).max(60),

  payment_type:    z.enum(['daily','monthly','hourly']),
  employment_type: z.enum(['fulltime','parttime','contract','daily','probation']),
  position_level:  z.enum(['intern','junior','mid','senior','lead','foreman','manager','general']).optional(),
  department:      z.string().max(60).optional(),

  base_salary:     z.coerce.number().min(0),
  daily_rate:      z.coerce.number().min(0).optional().nullable(),
  hourly_rate:     z.coerce.number().min(0).optional().nullable(),
  ot_multiplier:   z.coerce.number().min(1).max(5).default(1.5),
  sso_rate:        z.coerce.number().min(0).max(10).default(5),
  tax_rate:        z.coerce.number().min(0).max(30).default(0),
  standard_days_per_month: z.coerce.number().int().min(20).max(31).default(26),
  standard_hours_per_day:  z.coerce.number().int().min(1).max(24).default(8),

  national_id:        z.string().regex(/^\d{13}$/).optional(),
  birth_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender:             z.enum(['male','female','other']).optional(),
  nationality:        z.string().default('ไทย').optional(),
  marital_status:     z.enum(['single','married','divorced','widowed']).optional(),

  phone:              z.string().max(30).optional(),
  email:              z.string().email().optional(),
  address:            z.string().max(500).optional(),
  registered_address: z.string().max(500).optional(),

  emergency_contact_name:     z.string().max(120).optional(),
  emergency_contact_phone:    z.string().max(30).optional(),
  emergency_contact_relation: z.string().max(60).optional(),

  social_security_number: z.string().max(30).optional(),
  tax_id:                 z.string().max(30).optional(),

  bank_name:         z.string().max(60).optional(),
  bank_account:      z.string().max(40).optional(),
  bank_account_name: z.string().max(120).optional(),

  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  skills:          z.array(z.string()).default([]),
  certifications:  z.array(z.any()).default([]),
  license_numbers: z.array(z.any()).default([]),

  has_health_insurance: z.boolean().default(false),
  has_life_insurance:   z.boolean().default(false),
  vacation_days_per_year: z.coerce.number().int().min(0).default(6),
  sick_days_per_year:     z.coerce.number().int().min(0).default(30),
  personal_days_per_year: z.coerce.number().int().min(0).default(3),

  notes: z.string().max(1000).optional(),
})

export async function GET() {
  try {
    const { profile, db } = await requireAuth()
    return ok(await listEmployees(db, profile.org_id))
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin', 'manager')
    const body  = CreateSchema.parse(await req.json())
    const emp   = await createEmployee(db, profile.org_id, body as any)
    return created(emp)
  } catch (e) { return err(e) }
}
