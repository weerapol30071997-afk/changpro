# 📘 คู่มือติดตั้งช่างโปร — สำหรับมือใหม่ทุกคน

> เวอร์ชัน v7 Enterprise · ใช้เวลาประมาณ **90-120 นาที**
> 
> คู่มือนี้สำหรับคนที่ไม่เคยใช้ Next.js / Supabase มาก่อน อ่านทีละบรรทัด ทำตามได้เลย ห้ามข้ามนะครับ

---

## ⚡ TLDR — เส้นทางการติดตั้ง

```
1. ติดตั้ง Node.js + Git           → 15 นาที
2. สร้าง Supabase project          → 10 นาที
3. ดาวน์โหลด + npm install         → 10 นาที
4. ใส่ค่า .env.local                → 5 นาที
5. รัน database migrations          → 5 นาที
6. ตั้งค่า Google Login             → 15 นาที
7. รัน + ตั้งให้ตัวเองเป็น admin  → 10 นาที
8. ทดสอบทุกฟีเจอร์                  → 15 นาที
9. Deploy ขึ้น Vercel (option)       → 20 นาที
```

---

## 📚 สารบัญ

1. [ก่อนเริ่ม — สิ่งที่ต้องเตรียม](#step-0)
2. [ขั้นที่ 1: ติดตั้ง Node.js](#step-1)
3. [ขั้นที่ 2: ติดตั้ง Git](#step-2)
4. [ขั้นที่ 3: ติดตั้ง VS Code](#step-3)
5. [ขั้นที่ 4: สมัคร Supabase](#step-4)
6. [ขั้นที่ 5: สร้าง Supabase Project](#step-5)
7. [ขั้นที่ 6: เก็บ API Keys](#step-6)
8. [ขั้นที่ 7: ดาวน์โหลดโค้ด](#step-7)
9. [ขั้นที่ 8: เปิดโฟลเดอร์ใน VS Code](#step-8)
10. [ขั้นที่ 9: ติดตั้ง Dependencies (npm install)](#step-9)
11. [ขั้นที่ 10: สร้างไฟล์ .env.local](#step-10)
12. [ขั้นที่ 11: ติดตั้ง Supabase CLI](#step-11)
13. [ขั้นที่ 12: เชื่อมต่อ Project](#step-12)
14. [ขั้นที่ 13: รัน Migrations](#step-13)
15. [ขั้นที่ 14: เปิด Realtime](#step-14)
16. [ขั้นที่ 15: ตรวจสอบ Storage Buckets](#step-15)
17. [ขั้นที่ 16: สมัคร Google Cloud](#step-16)
18. [ขั้นที่ 17: ตั้งค่า OAuth](#step-17)
19. [ขั้นที่ 18: เชื่อม Google กับ Supabase](#step-18)
20. [ขั้นที่ 19: รันโปรเจกต์ครั้งแรก](#step-19)
21. [ขั้นที่ 20: ตั้งให้ตัวเองเป็น Admin](#step-20)
22. [ขั้นที่ 21: ตั้งค่าระบบเบื้องต้น](#step-21)
23. [ขั้นที่ 22: ทดสอบทุกฟีเจอร์](#step-22)
24. [ขั้นที่ 23: Deploy ขึ้น Vercel](#step-23)
25. [แก้ปัญหาที่พบบ่อย](#troubleshooting)

---

<a name="step-0"></a>
## 🎒 ก่อนเริ่ม — สิ่งที่ต้องเตรียม

### ฮาร์ดแวร์
- คอมพิวเตอร์ Windows 10/11 หรือ Mac
- RAM อย่างน้อย 8GB (แนะนำ 16GB)
- พื้นที่ว่างในเครื่อง ≥ 2GB

### บัญชีที่ต้องมี
- ✅ บัญชี Google (ใช้ login ระบบ + Google Cloud)
- ✅ บัญชี GitHub (ใช้สมัคร Supabase + deploy)
- ✅ บัญชีอีเมลที่ใช้งานจริง

### ทักษะที่ต้องมี
- เปิด Terminal / Command Prompt ได้
- Copy / Paste คำสั่งได้
- อ่านภาษาอังกฤษพื้นฐานได้

> 💡 ถ้าทำตามคู่มือทุกขั้นโดยไม่ข้าม ไม่ต้องรู้เรื่องโปรแกรมมิ่งก็ติดตั้งได้

---

<a name="step-1"></a>
## ขั้นที่ 1: ติดตั้ง Node.js

**Node.js** คือโปรแกรมที่ทำให้คอมเรารัน JavaScript ได้ ถ้าไม่มีตัวนี้ ระบบจะไม่ทำงาน

### 1.1 ไปที่เว็บไซต์
เปิดเบราว์เซอร์ → **https://nodejs.org**

### 1.2 ดาวน์โหลด
หน้าเว็บจะมีปุ่มเขียว 2 ปุ่ม → คลิกปุ่มซ้าย ที่เขียนว่า **LTS** (เลขเวอร์ชันต้องเป็น **20.x.x หรือสูงกว่า**)

### 1.3 ติดตั้ง

**Windows:**
- เปิดไฟล์ `.msi` ที่ดาวน์โหลด
- กด Next → Next → Next → Install (ใช้ default ทุกอย่าง)
- ติ๊กถูก **"Automatically install necessary tools"** ถ้ามี
- รอจนเสร็จ ~3 นาที

**Mac:**
- เปิดไฟล์ `.pkg`
- กดเข้า ใส่รหัสเครื่องถ้าถาม

### 1.4 ตรวจสอบว่าติดตั้งสำเร็จ

**สำคัญ: ปิดและเปิด Terminal/PowerShell ใหม่ทุกครั้งหลังติดตั้งโปรแกรมใหม่**

เปิด **Terminal** (Mac) หรือ **PowerShell** (Windows) — วิธีเปิด:
- Mac: กด `Cmd + Space` พิมพ์ "Terminal" → Enter
- Windows: กด `Win` พิมพ์ "PowerShell" → Enter

พิมพ์คำสั่งนี้แล้วกด Enter:

```bash
node --version
```

**ผลลัพธ์ที่ต้องเห็น:**
```
v20.11.0
```
(ตัวเลขอาจไม่เหมือนเป๊ะ แต่ขึ้นต้นด้วย `v20.` หรือสูงกว่า ถือว่าผ่าน)

**ถ้าขึ้น `command not found`:**
- Windows: restart เครื่อง 1 ครั้ง
- Mac: ปิด Terminal สนิทแล้วเปิดใหม่

ลองอีกครั้ง:
```bash
npm --version
```
ต้องเห็น `10.x.x` ขึ้นมา

---

<a name="step-2"></a>
## ขั้นที่ 2: ติดตั้ง Git

**Git** คือเครื่องมือสำหรับจัดการเวอร์ชันของโค้ด

### Windows
- ไปที่ **https://git-scm.com/download/win**
- โหลดมาแล้วเปิดติดตั้ง — กด Next ทุกอย่าง (default ดีอยู่แล้ว)
- เลือก **"Use Visual Studio Code as Git's default editor"** ถ้ามี

### Mac
- พิมพ์ใน Terminal:
```bash
git --version
```
- ถ้าขึ้น popup "command line developer tools" → กด Install
- ไม่มี popup ก็เลื่อนไปขั้นต่อไปได้

### ตรวจสอบ
```bash
git --version
```
ต้องเห็น `git version 2.x.x`

---

<a name="step-3"></a>
## ขั้นที่ 3: ติดตั้ง VS Code

**VS Code** คือโปรแกรมแก้ไขโค้ดที่ใช้ฟรี ทำให้แก้ไฟล์ `.env.local` ได้ง่าย

### ดาวน์โหลด
**https://code.visualstudio.com** → กดปุ่มดาวน์โหลดที่ตรงกับเครื่องตัวเอง → ติดตั้งปกติ

### เปิด VS Code แล้วติดตั้ง Extensions

กดไอคอน 🧩 (Extensions) ด้านซ้าย หรือกด `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)

ค้นหาและกด Install ทีละตัว:

1. **ES7+ React/Redux/React-Native snippets**
2. **Tailwind CSS IntelliSense**
3. **Thai Language Pack** (ถ้าอยากให้เมนูเป็นภาษาไทย)

---

<a name="step-4"></a>
## ขั้นที่ 4: สมัคร Supabase

**Supabase** คือ database + auth พร้อมใช้งาน เราจะใช้แบบฟรี ไม่ต้องใส่บัตรเครดิต

### 4.1 ไปที่เว็บ
**https://supabase.com** → กดปุ่ม **Start your project** มุมบนขวา

### 4.2 Sign in

แนะนำให้ใช้ **Continue with GitHub** เพราะใช้ตอน deploy ด้วย
- ถ้ายังไม่มี GitHub → สมัครที่ **https://github.com/signup** ก่อน (10 วินาที)
- กด Continue with GitHub → Authorize

### 4.3 ยืนยันอีเมล (ถ้ามี)
เช็คอีเมล → กดลิงก์ในเมล

---

<a name="step-5"></a>
## ขั้นที่ 5: สร้าง Supabase Project

หลัง login จะเห็นหน้า Dashboard ว่างเปล่า

### 5.1 กด New Project
- ถ้าครั้งแรก → จะให้สร้าง Organization → ตั้งชื่อ "My Org" หรืออะไรก็ได้ → Create

### 5.2 กรอกข้อมูล Project

| ช่อง | กรอก |
|------|------|
| **Name** | `changpro` |
| **Database Password** | ตั้งรหัสที่ปลอดภัย เช่น `Chang@2026!secure` |
| **Region** | **Southeast Asia (Singapore)** ⚠️ สำคัญมาก |
| **Pricing Plan** | **Free** |

> 🔥 **สำคัญที่สุด:** จด Database Password ไว้ในที่ปลอดภัย ลืมแล้วต้องสร้าง project ใหม่
>
> ⚠️ **Region:** ต้องเลือก Singapore เท่านั้น ถ้าเลือกที่อื่นความเร็วจะแย่มาก

### 5.3 กด Create new project

จะเห็นข้อความว่า "Setting up project..." → รอประมาณ **2-3 นาที**

อย่าปิดหน้านี้ — รอจนเห็นข้อความ "Project is healthy" ขึ้นมา

---

<a name="step-6"></a>
## ขั้นที่ 6: เก็บ API Keys

นี่คือกุญแจสำหรับเชื่อมโปรเจกต์เรากับ Supabase

### 6.1 ไปที่ Settings

ด้านซ้ายมุมล่าง มีไอคอน ⚙️ (เฟือง) → กด → ในเมนูเลือก **API**

### 6.2 เก็บ 3 ค่า

จะเห็น 3 ส่วน — **คัดลอกใส่ Notepad หรือ Notes ทั้งหมด** จะใช้ตอนใส่ใน .env.local

#### ค่าที่ 1: Project URL
```
https://xxxxxxxxxxxxx.supabase.co
```

#### ค่าที่ 2: anon public key
ในส่วน "Project API keys" — แถวบน
```
eyJhbGciOiJIUzI1NiIsInR5...........................
```
(ยาวมาก ~300 ตัวอักษร)

#### ค่าที่ 3: service_role key
แถวล่าง — คลิกที่ตา 👁 เพื่อแสดง
```
eyJhbGciOiJIUzI1NiIsInR5...........................
```

> 🚨 **ห้ามลืม:** `service_role` มีสิทธิ์เต็มในการแก้ database ห้ามแชร์, ห้าม commit ลง Git, ห้ามใส่ในโค้ดที่ user เห็น

### 6.3 เก็บ Project Reference

ยังอยู่หน้า Settings → กด **General**

หา **Reference ID** — เป็นชุดตัวอักษร เช่น `abcdefghijklmnop` → คัดลอกเก็บไว้ด้วย

---

<a name="step-7"></a>
## ขั้นที่ 7: ดาวน์โหลดโค้ด

### 7.1 หาที่เก็บโปรเจกต์

แนะนำเก็บใน Documents

### 7.2 Unzip ไฟล์ changpro.zip

- เปิด folder ที่มีไฟล์ `changpro.zip`
- Windows: คลิกขวา → **Extract All** → เลือกที่ → Extract
- Mac: ดับเบิ้ลคลิกไฟล์ — จะ extract เอง

### 7.3 ตรวจสอบ

เปิด folder `changpro` ที่ unzip มา จะเห็นไฟล์เหล่านี้:
```
changpro/
├── INSTALL.md       ← คู่มือนี้
├── README.md
├── package.json
├── .env.example
├── src/
├── supabase/
└── ... อีกหลายไฟล์
```

---

<a name="step-8"></a>
## ขั้นที่ 8: เปิดโฟลเดอร์ใน VS Code

### 8.1 เปิด VS Code

### 8.2 File → Open Folder (Mac: Open...)

หา folder `changpro` ที่ unzip มา → กด **Select Folder** / **Open**

ถ้าถาม "Do you trust the authors?" → กด **Yes, I trust the authors**

### 8.3 เปิด Terminal ในตัว VS Code

เมนูบน → **Terminal** → **New Terminal** (หรือกด `` Ctrl+` ``)

จะเห็น Terminal เปิดขึ้นด้านล่าง — **อย่าใช้ Terminal เดี่ยวๆ ใช้ของ VS Code เพราะมัน "อยู่ใน folder changpro" แล้ว**

ลองพิมพ์:
```bash
pwd
```

ต้องเห็น path ลงท้ายด้วย `/changpro` หรือ `\changpro`

---

<a name="step-9"></a>
## ขั้นที่ 9: ติดตั้ง Dependencies (npm install)

นี่คือขั้นตอนที่ใช้เวลานานสุด ~3-5 นาที

### 9.1 ใน Terminal ของ VS Code พิมพ์:

```bash
npm install
```

### 9.2 รอจนเสร็จ

จะเห็นข้อความสีต่างๆ เลื่อนผ่าน — **เป็นเรื่องปกติ**

ตอนท้ายจะเห็น:
```
added 387 packages, and audited 388 packages in 4m
found 0 vulnerabilities
```

ถ้ามี `warning` หรือ `deprecated` — **ไม่ต้องสนใจ** ไม่ใช่ error

### 9.3 ถ้าเจอ Error สีแดง

ลองวิธีนี้:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

Windows ถ้า `rm` ใช้ไม่ได้:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

---

<a name="step-10"></a>
## ขั้นที่ 10: สร้างไฟล์ .env.local

ไฟล์นี้เก็บ API keys ของเรา — เปรียบเหมือนรหัสเข้าบ้าน

### 10.1 คัดลอกไฟล์ template

ใน Terminal:

**Mac/Linux:**
```bash
cp .env.example .env.local
```

**Windows:**
```bash
copy .env.example .env.local
```

### 10.2 เปิดไฟล์ .env.local ใน VS Code

ใน VS Code ด้านซ้ายจะเห็น file explorer → คลิก `.env.local`

(ถ้าไม่เห็น — กดไอคอนรูปกระดาษ 📄 ด้านซ้ายบนสุด)

### 10.3 แก้ไขไฟล์

จะเห็นเนื้อหาประมาณนี้:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
...
```

**แทนค่าด้วยที่เก็บไว้จากขั้นที่ 6:**

```env
# ─── จาก Supabase ขั้นที่ 6 ────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc......(ยาวๆ)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc......(ยาวๆ)

# ─── App settings ──────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=ช่างโปร

# ─── LINE (ใส่ทีหลังได้ — ข้ามไปก่อน) ──────────
LINE_CLIENT_ID=
LINE_CLIENT_SECRET=

# ─── NextAuth (จะสร้างในขั้นต่อไป) ─────────────
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

### 10.4 สร้าง NEXTAUTH_SECRET

ใน Terminal:

**Mac/Linux:**
```bash
openssl rand -base64 32
```

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

จะได้ string ออกมา เช่น:
```
8j3qHvLm9Kp2Nx7Yz4F6sR1tWQbEa5gIuP0OcCdVxTo=
```

คัดลอกใส่ในบรรทัด `NEXTAUTH_SECRET=`:
```env
NEXTAUTH_SECRET=8j3qHvLm9Kp2Nx7Yz4F6sR1tWQbEa5gIuP0OcCdVxTo=
```

### 10.5 บันทึก

กด `Ctrl+S` (Mac: `Cmd+S`)

---

<a name="step-11"></a>
## ขั้นที่ 11: ติดตั้ง Supabase CLI

CLI คือเครื่องมือใช้รัน database migrations

### 11.1 ติดตั้งผ่าน npm

ใน Terminal:
```bash
npm install -g supabase
```

> 💡 ตัว `-g` แปลว่า "global" — ติดตั้งทั้งเครื่อง ใช้ได้ทุก project

### 11.2 ตรวจสอบ

```bash
supabase --version
```
ต้องเห็น `1.x.x` ขึ้นมา

ถ้าขึ้น `command not found`:
- Windows: ปิด Terminal แล้วเปิดใหม่ (restart VS Code ก็ได้)
- Mac: ลองใส่ `npx supabase` แทนทุกครั้ง

---

<a name="step-12"></a>
## ขั้นที่ 12: เชื่อมต่อ Project

### 12.1 Login

```bash
supabase login
```

จะเปิดเบราว์เซอร์ → กด **Authorize**

### 12.2 Link กับ project

```bash
supabase link --project-ref xxxxxxxxxxxxx
```

> เปลี่ยน `xxxxxxxxxxxxx` เป็น Reference ID ที่จดไว้ในขั้นที่ 6.3

ระบบจะถาม **Database password** → ใส่รหัสที่ตั้งตอนสร้าง project (ขั้นที่ 5.2)

ผลลัพธ์:
```
Finished supabase link.
```

---

<a name="step-13"></a>
## ขั้นที่ 13: รัน Migrations

นี่คือขั้นตอนสร้างตารางทั้งหมดใน database

### 13.1 รัน

```bash
supabase db push
```

ระบบจะถามให้ยืนยัน — พิมพ์ `y` กด Enter

จะเห็นข้อความ:
```
Applying migration 20240101000000_init.sql...
Applying migration 20240102000000_tracking.sql...
Applying migration 20240103000000_storage.sql...
Applying migration 20240104000000_employee_data.sql...
Applying migration 20240105000000_jobs_workflow.sql...
Applying migration 20240106000000_job_assign.sql...
Applying migration 20240107000000_enterprise.sql...
Finished supabase db push.
```

ใช้เวลา 1-2 นาที

### 13.2 ตรวจสอบใน Supabase

กลับไปที่ Supabase Dashboard → ด้านซ้ายกด **Table Editor**

ต้องเห็น tables เหล่านี้ (กว่า 20 ตาราง):

**Core:**
- organizations
- profiles
- employees
- time_logs
- jobs
- payroll_periods

**Tracking:**
- work_sites
- location_tracks
- notifications
- push_subscriptions

**CRM + Enterprise:**
- customers
- services
- holidays (มี 18 รายการ seed สำเร็จ)
- documents

**Inventory:**
- materials
- material_movements
- job_materials

**HR:**
- leave_requests
- ratings
- audit_log

ถ้าครบ → ผ่าน! ถ้าไม่ครบ → migration บางตัวล้มเหลว ดู [Troubleshooting](#troubleshooting)

---

<a name="step-14"></a>
## ขั้นที่ 14: เปิด Realtime

ขั้นนี้ทำให้ notification ส่ง real-time ได้

### 14.1 ไปที่ Database → Replication

ใน Supabase Dashboard เมนูซ้าย → **Database** → **Replication**

### 14.2 หา table `notifications`

scroll หา row ที่ชื่อ `notifications`

### 14.3 เปิด toggle

ด้านขวาของ row จะมี switch — กดให้เป็น **ON** (สีเขียว)

> 💡 ถ้าไม่ทำขั้นนี้ — แอดมินจะไม่ได้รับ notification real-time แต่ระบบยังทำงานได้ปกติ

---

<a name="step-15"></a>
## ขั้นที่ 15: ตรวจสอบ Storage Buckets

### 15.1 ไปที่ Storage

เมนูซ้าย → **Storage**

### 15.2 ตรวจ buckets

ต้องเห็น 3 buckets:
- ✅ `timeclock-photos` (5MB, Public)
- ✅ `employee-assets` (2MB, Public)
- ✅ `job-photos` (10MB, Public)

### 15.3 ถ้าไม่ครบ — สร้างเอง

กด **New bucket** → กรอกตามตารางด้านบน:
- Name: ใส่ตามชื่อ
- Public bucket: เปิด ✓
- File size limit: ตามขนาด

---

<a name="step-16"></a>
## ขั้นที่ 16: สมัคร Google Cloud

เพื่อให้ login ผ่าน Google ได้

### 16.1 ไปที่ Google Cloud Console

**https://console.cloud.google.com**

Login ด้วยบัญชี Google (อันเดียวกับที่จะใช้ login ระบบ)

### 16.2 ยอมรับ Terms

ถ้าครั้งแรก — ติ๊ก **I agree** → Continue

### 16.3 สร้าง Project

มุมบนซ้าย (ข้าง Google Cloud) → คลิก dropdown → **NEW PROJECT**

| ช่อง | กรอก |
|------|------|
| **Project name** | `ChangPro` |
| **Organization** | No organization |

→ กด **CREATE**

รอ ~30 วินาที → กด **SELECT PROJECT** เพื่อเข้าใช้งาน

---

<a name="step-17"></a>
## ขั้นที่ 17: ตั้งค่า OAuth

### 17.1 เปิด APIs & Services

เมนูซ้าย (กดเส้น 3 เส้น ☰ ถ้าไม่เห็น) → **APIs & Services** → **OAuth consent screen**

### 17.2 เลือก User Type

- เลือก **External** → กด CREATE

### 17.3 กรอก App information

| ช่อง | กรอก |
|------|------|
| **App name** | ช่างโปร |
| **User support email** | อีเมลของตัวเอง |
| **Developer contact** | อีเมลของตัวเอง |

กด **SAVE AND CONTINUE** ผ่านทุกหน้า (Scopes, Test users) จนถึงสุดท้าย กด **BACK TO DASHBOARD**

### 17.4 สร้าง OAuth Credentials

เมนูซ้าย → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**

| ช่อง | กรอก |
|------|------|
| **Application type** | Web application |
| **Name** | ChangPro Web |

**Authorized JavaScript origins** — กด ADD URI 2 ครั้ง:
```
http://localhost:3000
https://your-app.vercel.app
```
(URL ที่ 2 ใส่ทีหลังตอน deploy ก็ได้)

**Authorized redirect URIs** — กด ADD URI:
```
https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
```
> เปลี่ยน `xxxxxxxxxxxxx` เป็น project ref ของเรา

กด **CREATE**

### 17.5 เก็บ Client ID + Secret

จะมี popup ขึ้นมาแสดง:
- **Client ID**
- **Client Secret**

**คัดลอกทั้งคู่เก็บไว้!** (popup ปิดแล้วก็ดูใหม่ได้ใน Credentials)

---

<a name="step-18"></a>
## ขั้นที่ 18: เชื่อม Google กับ Supabase

### 18.1 กลับไปที่ Supabase Dashboard

### 18.2 ไปที่ Authentication

เมนูซ้าย → **Authentication** → **Providers**

### 18.3 หา Google

scroll หา **Google** → คลิก

### 18.4 เปิด toggle

ด้านบน → toggle **Enable Google provider** ให้เป็น ON

### 18.5 ใส่ Client ID + Secret

วาง 2 ค่าจากขั้นที่ 17.5

### 18.6 ใส่ Authorized Client IDs (สำคัญ!)

ในช่อง **Authorized Client IDs** ใส่ **Client ID** ตัวเดิมอีกครั้ง

### 18.7 กด Save

---

<a name="step-19"></a>
## ขั้นที่ 19: รันโปรเจกต์ครั้งแรก

ตื่นเต้นแล้ว!

### 19.1 ใน Terminal ของ VS Code

```bash
npm run dev
```

### 19.2 รอ ~5 วินาที

จะเห็น:
```
   ▲ Next.js 14.2.5
   - Local:        http://localhost:3000
   - Environments: .env.local

 ✓ Ready in 3.2s
```

> ⚠️ **อย่าปิด Terminal** — ถ้าปิดเว็บจะดับ
> ถ้าจะทำงานอื่นใน Terminal — เปิด tab ใหม่ที่ VS Code (+ ด้านขวาบน)

### 19.3 เปิดเบราว์เซอร์

ไปที่ **http://localhost:3000**

### 19.4 ทดสอบ Login

จะถูก redirect ไปหน้า `/login`

กดปุ่ม **เข้าสู่ระบบด้วย Google**

- เลือกบัญชี Google
- กด Continue
- ถ้าขึ้นเตือน "App not verified" → กด **Advanced** → **Go to ChangPro (unsafe)** (เพราะแอปยังไม่ได้ verify กับ Google — ไม่อันตรายเพราะเป็นแอปของเราเอง)
- Authorize

### 19.5 ถ้าเข้าได้

จะเด้งไป `/dashboard` — เห็นหน้าว่างเปล่า ไม่มีเมนู เพราะยังไม่ใช่ admin

**🎉 ระบบใช้งานได้แล้ว! เหลือตั้งให้ตัวเองเป็น admin**

---

<a name="step-20"></a>
## ขั้นที่ 20: ตั้งให้ตัวเองเป็น Admin

### 20.1 หา User UID ของตัวเอง

กลับไป Supabase → **Authentication** → **Users**

จะเห็นแถวของอีเมลตัวเอง → คลิกที่ **3 จุด** ขวาสุด → **Copy User UID**

(หรือคลิกที่ตัวเองเพื่อดู UID แล้ว copy)

UID จะเป็นแบบนี้: `a1b2c3d4-5678-9abc-def0-123456789abc`

### 20.2 รัน SQL

Supabase → ด้านซ้าย → **SQL Editor** → กด **+ New query**

วาง SQL นี้ใน editor (เปลี่ยน `YOUR_USER_UID` เป็น UID ที่ copy):

```sql
-- ตั้งให้ตัวเองเป็น admin
UPDATE profiles
SET role = 'admin',
    org_id = '00000000-0000-0000-0000-000000000001'
WHERE id = 'YOUR_USER_UID';

-- ตรวจสอบ
SELECT id, full_name, role, org_id
FROM profiles
WHERE id = 'YOUR_USER_UID';
```

กดปุ่ม **Run** ขวาล่าง (หรือ `Cmd+Enter` / `Ctrl+Enter`)

**ผลลัพธ์ที่ต้องเห็น:**
- ข้อความ "Success. No rows returned" ที่ตอนแรก
- ด้านล่างมีตาราง 1 แถว แสดง `role = admin`

### 20.3 Refresh เว็บ

กลับไปที่ http://localhost:3000 → กด **F5**

### 20.4 🎉 ตอนนี้เห็นเมนูครบหมด

ด้านซ้าย:
- **กลุ่มหลัก:** ภาพรวม, งาน, ลูกค้า
- **กลุ่มพนักงาน:** ช่าง, ลงเวลา, การลา, เงินเดือน
- **กลุ่มการติดตาม:** GPS Live, พื้นที่
- **กลุ่มจัดการ:** บริการ, วัสดุ, วันหยุด, รายงาน, ตั้งค่า

---

<a name="step-21"></a>
## ขั้นที่ 21: ตั้งค่าระบบเบื้องต้น

### 21.1 ตั้งค่าบริษัท

ไปที่ **ตั้งค่า** → กรอกข้อมูลบริษัท:
- ชื่อบริษัท
- เลขผู้เสียภาษี
- ที่อยู่
- เบอร์โทร
- อีเมล
- เวลาทำงาน (8:00-17:00 default)
- วันทำงาน (จ-ศ default)
- อัตรา OT วันหยุด (3 เท่า default)

กด **บันทึก**

### 21.2 เพิ่มบริการ (Service Catalog)

ไปที่ **บริการ** → กด **เพิ่ม**

ตัวอย่าง:
- ชื่อบริการ: `ซ่อมไฟฟ้าทั่วไป`
- หมวด: ไฟฟ้า
- ราคามาตรฐาน: 500
- หน่วย: ชั่วโมง
- เวลาประมาณ: 60 นาที

ทำประมาณ 3-5 บริการให้พอใช้

### 21.3 เพิ่มวัสดุ (Inventory)

ไปที่ **วัสดุ** → กด **เพิ่ม**

ตัวอย่าง:
- ชื่อ: `หลอด LED 9W`
- หน่วย: ดวง
- ต้นทุน: 50
- ราคาขาย: 80
- คงเหลือเริ่มต้น: 50
- แจ้งเตือนเมื่อต่ำกว่า: 10

### 21.4 เช็ควันหยุด

ไปที่ **วันหยุด** → จะเห็นวันหยุดไทยปี 2026 มี 18 รายการ seed ไว้แล้ว ✅

### 21.5 เพิ่มลูกค้าคนแรก

ไปที่ **ลูกค้า** → กด **เพิ่ม**

ตัวอย่าง:
- ชื่อ: `คุณสมหมาย`
- ประเภท: บุคคล
- เบอร์: 081-234-5678
- ที่อยู่: ...

### 21.6 เพิ่มช่างคนแรก

ไปที่ **ช่าง** → กด **เพิ่ม**

กรอก 7 แท็บ:
- **พื้นฐาน:** ชื่อ, ตำแหน่ง (ช่างไฟฟ้า)
- **เงินเดือน:** เลือก รายเดือน 18,000 ฿
- **ส่วนตัว:** เลขบัตรประชาชน 13 หลัก
- **ติดต่อ:** เบอร์, ผู้ติดต่อฉุกเฉิน
- **ธนาคาร:** ใส่บัญชี
- **ทักษะ:** เพิ่ม "เชื่อมไฟ", "ใบช่างไฟ"
- **สวัสดิการ:** check ประกันสุขภาพ

กด **เพิ่มพนักงาน**

### 21.7 เพิ่มพื้นที่ทำงาน

ไปที่ **พื้นที่** → กด **เพิ่ม**

- ชื่อ: บริษัทลูกค้า A
- กดปุ่ม "ใช้ตำแหน่งปัจจุบัน" — Browser จะถาม permission → Allow
- รัศมี: 150 เมตร

### 21.8 สร้างงานแรก

ไปที่ **งาน** → กด **สร้างงาน**

- ชื่องาน: `เปลี่ยนหลอดไฟอาคาร A`
- เลือกลูกค้า
- มอบหมายให้ช่างคนที่เพิ่ม
- ความสำคัญ: ปกติ
- ราคาประมาณ: 500

---

<a name="step-22"></a>
## ขั้นที่ 22: ทดสอบทุกฟีเจอร์

### 22.1 ทดสอบลงเวลา

1. คลิกหน้าโปรไฟล์ขวาบน → Logout
2. Login ใหม่ด้วย account ของช่าง (สร้างจากขั้น 21.6)
3. ไปที่ **ลงเวลา**
4. กดปุ่ม **เข้างาน**
5. Browser ขอ permission GPS → Allow
6. ขอ permission กล้อง → Allow
7. ถ่ายรูป → กด ใช้รูปนี้
8. ✅ เห็นข้อความ "เข้างานเรียบร้อย"

### 22.2 ทดสอบงาน (เป็นช่าง)

1. ไปที่ **งาน** จะเห็นงานที่ได้รับมอบหมาย
2. กดเข้างาน → กด **เริ่มงาน (ถ่ายรูปก่อน)**
3. ถ่ายรูปก่อน 1-3 รูป
4. ✅ สถานะเปลี่ยนเป็น "กำลังทำ"
5. กด **ส่งตรวจ (ถ่ายรูปหลัง)**
6. ถ่ายรูปหลัง + กรอกสรุปงาน
7. ✅ ส่งงานเรียบร้อย

### 22.3 ทดสอบตรวจงาน (เป็น admin)

1. Logout → Login ใหม่เป็น admin
2. ไป **งาน** → เห็น banner สีเหลือง "1 งานรอตรวจ"
3. คลิกที่งาน → กด **ตรวจงาน**
4. เลือก **ผ่าน** หรือ **ไม่ผ่าน**
5. ถ้าไม่ผ่าน — ใส่เหตุผล (บังคับ)
6. ✅ บันทึก

### 22.4 ทดสอบเงินเดือน

1. ไปที่ **เงินเดือน** → กดที่ช่าง
2. PayrollBuilder เปิดขึ้น 6 ขั้น
3. ระบบดึงเวลาทำงานจริงจากที่ลงไว้
4. เห็นยอดสุทธิ real-time
5. กด **สร้างสลิป** → อนุมัติ → จ่ายเงิน

### 22.5 ดู Notifications

หัวข้อขวาบน — มี Notification Bell 🔔 จะเด้งเตือนเรียลไทม์

### 22.6 ดู Dashboard

ไปหน้า **ภาพรวม** เห็น:
- 6 stat cards
- KPI banner รายได้ของปี
- กราฟ Bar Chart
- Top performers
- Alerts

---

<a name="step-23"></a>
## ขั้นที่ 23: Deploy ขึ้น Vercel (ฟรี)

ถ้าอยากให้คนอื่นเข้าเว็บได้ ไม่ต้องเปิดคอมตลอด

### 23.1 Push โค้ดขึ้น GitHub

#### สร้าง repo ใหม่

ไปที่ **https://github.com/new**:
- Repository name: `changpro`
- Private (แนะนำ)
- ไม่ต้องติ๊ก initialize อะไร

→ Create repository

#### ใน VS Code Terminal:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourname/changpro.git
git branch -M main
git push -u origin main
```

> เปลี่ยน `yourname` เป็น GitHub username

### 23.2 สมัคร Vercel

**https://vercel.com** → Sign Up → **Continue with GitHub**

### 23.3 Import Project

Dashboard → **Add New** → **Project**

หา `changpro` → กด **Import**

### 23.4 Configure

**Framework Preset:** Next.js (auto detect)

**Environment Variables** — เพิ่มทุกตัวจาก `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL          ← ตอนนี้ยังไม่รู้ ใส่ http://localhost:3000 ก่อน
NEXT_PUBLIC_APP_NAME
NEXTAUTH_SECRET
NEXTAUTH_URL                  ← ตอนนี้ยังไม่รู้ ใส่ http://localhost:3000 ก่อน
LINE_CLIENT_ID                ← ถ้ามี
LINE_CLIENT_SECRET            ← ถ้ามี
```

### 23.5 Deploy

กด **Deploy** → รอ 2-3 นาที

### 23.6 ได้ URL

Vercel จะให้ URL เช่น `https://changpro-xyz.vercel.app`

### 23.7 อัปเดต URL กลับ

**ใน Vercel:**
- Settings → Environment Variables
- แก้ `NEXT_PUBLIC_APP_URL` และ `NEXTAUTH_URL` → ใส่ URL จริง
- กด **Redeploy**

**ใน Google Cloud Console:**
- Credentials → กด OAuth client ที่สร้าง
- เพิ่ม `https://changpro-xyz.vercel.app` ใน Authorized JavaScript origins

**ใน Supabase:**
- Authentication → URL Configuration
- Site URL: `https://changpro-xyz.vercel.app`
- Redirect URLs: `https://changpro-xyz.vercel.app/**`

ใช้งานได้แล้ว 🎉

---

<a name="troubleshooting"></a>
## 🆘 แก้ปัญหาที่พบบ่อย

### ❌ npm install ค้าง / error

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### ❌ "Cannot find module" ตอนรัน

ไม่ได้รัน `npm install` หรือรันไม่เสร็จ → รันใหม่

### ❌ Browser console: "Failed to fetch"

`.env.local` กรอกผิด หรือ Supabase URL ไม่ถูก — เช็คอีกครั้ง

### ❌ "Invalid login credentials" ตอน login

1. ตรวจ Site URL ใน Supabase ตรงกับที่ใช้งานจริง (`http://localhost:3000`)
2. ตรวจ Google OAuth Authorized origins มี `http://localhost:3000`
3. Clear cookies แล้วลองใหม่

### ❌ ไม่มีเมนูหลัง Login

ยังไม่ได้ทำขั้นที่ 20 (ตั้งเป็น admin) — กลับไปทำ

### ❌ Camera ไม่เปิด (PHOTO_REQUIRED)

- Browser ต้อง allow camera access (ดู icon ซ้ายของ URL bar)
- ใช้ HTTPS เท่านั้น (localhost ใช้ได้)
- ลอง browser อื่น (Chrome แนะนำ)

### ❌ GPS ไม่ทำงาน (GPS_REQUIRED)

- Browser settings → Site permissions → Location → Allow
- ต้องเปิด GPS ของเครื่อง (มือถือ/notebook)
- ใช้ HTTPS

### ❌ Notification ไม่ขึ้นแบบ realtime

ไม่ได้เปิด Replication — กลับไปขั้นที่ 14

### ❌ "Permission denied for table"

User profile ไม่มี org_id — รัน SQL ขั้นที่ 20.2 ใหม่

### ❌ Migration ล้มเหลว

```bash
supabase db push --debug
```
ดู error message — ส่วนใหญ่เพราะ migration ก่อนหน้ายังไม่จบสมบูรณ์

แก้: เปิด SQL Editor ใน Supabase → รัน migration ทีละไฟล์ด้วยตัวเอง

### ❌ Vercel build fail

ดู build log → ส่วนใหญ่:
- Missing environment variable → เพิ่มใน Vercel
- TypeScript error → ลอง `npm run build` ที่เครื่องก่อน

---

## ✅ Checklist ติดตั้งครบ

- [ ] Node.js 20 ติดตั้งแล้ว (`node --version` ขึ้น v20.x)
- [ ] Git + VS Code ติดตั้งแล้ว
- [ ] Supabase project สร้างใน Singapore region
- [ ] เก็บ API keys ครบ 3 ตัว
- [ ] Unzip + npm install สำเร็จ
- [ ] .env.local กรอกค่าครบ
- [ ] Supabase CLI ติดตั้งและ link แล้ว
- [ ] รัน migrations ครบ 7 ไฟล์
- [ ] Realtime ของ notifications เปิด
- [ ] Storage 3 buckets ครบ
- [ ] Google OAuth ตั้งค่าครบ
- [ ] `npm run dev` ขึ้นที่ http://localhost:3000
- [ ] Login Google สำเร็จ
- [ ] ตัวเองเป็น admin
- [ ] เห็นเมนูครบ 4 กลุ่ม
- [ ] ทดสอบลงเวลา + ถ่ายรูปได้
- [ ] ทดสอบสร้าง+มอบหมายงานได้
- [ ] สร้างพนักงาน + ลูกค้า + วัสดุได้

---

## 📞 ติดปัญหา?

1. ดู **Browser Console** (กด F12) — มี error สีแดงไหม
2. ดู **Terminal log** ของ `npm run dev`
3. ดู **Supabase Logs** (Dashboard → Logs → Postgres/Edge)
4. Google ข้อความ error
5. ถ้ายังไม่ได้ — ลบ folder `changpro` แล้ว unzip ใหม่ ทำตามใหม่ทีละขั้น

ขอให้สนุกกับการใช้งาน ChangPro 🎉🔧

---

## 📖 ลิงก์อ้างอิง

- **Next.js docs:** https://nextjs.org/docs
- **Supabase docs:** https://supabase.com/docs
- **Tailwind CSS:** https://tailwindcss.com
- **Recharts:** https://recharts.org
- **React Hook Form:** https://react-hook-form.com
