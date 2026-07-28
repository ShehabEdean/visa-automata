# Dossier — Visa & Passport Registry

A web-based tool for managing visa applications, replacing paper-based case files with a searchable digital registry.

## Goal

Manage stacks of scanned passports and visa application papers — make them digital, searchable, and organized by category, status, and family groups.

## Features

- **Passport OCR** — upload a scan and the MRZ (machine-readable zone) is read automatically to fill in passport fields
- **Search** — find entries by name, passport number, phone, email, nationality, etc.
- **Categories** — First Application, Renewal, Family Visit, Business/Affair (customizable)
- **Status tracking** — color-coded: Pending, Submitted, Interview, Approved, Rejected, Complete
- **Family grouping** — bundle related applications under one group with a primary contact
- **Payment tracking** — paid/unpaid status per entry
- **Dark mode** — toggle between light and dark themes
- **CSV export** — download all records as a spreadsheet
- **Image attachments** — store passport/visa page scans per entry

## Tech Stack

- **Frontend** — vanilla HTML/CSS/JS (single file)
- **Backend** — Supabase (PostgreSQL database + auth + file storage)
- **Hosting** — GitHub Pages

## Setup

1. Create a free [Supabase](https://supabase.com) project
2. Run the SQL in `schema.sql` (and any migrations in `migrations/`) in the Supabase SQL Editor
3. Create user accounts in Supabase Authentication
4. Update `SUPABASE_URL` and `SUPABASE_ANON` in `registry.html`
5. Deploy to GitHub Pages or open `registry.html` directly

## File Structure

```
registry.html      — main application (HTML + CSS + JS)
schema.sql         — initial database schema
migrations/        — incremental SQL migrations
```
