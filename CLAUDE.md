# Foami Project Guidelines

## Project Context
Foami is a premium car wash and vehicle services management application.

## Design Context

### Users
- **Customers**: Booking motorbike wash/services via LINE LIFF. Needs ease of use and trust.
- **Staff**: Riders and cleaners managing their tasks and schedules. Needs clarity and efficiency.
- **Admin**: Full system management (CRM, business operations). Needs data density and control.

### Brand Personality
Professional, Trustworthy, Modern, Premium.
**3-word personality**: Impeccable, Efficient, Delightful.

### Aesthetic Direction
- **Style**: Impeccable Style (Clean, premium, high-quality typography, smooth micro-interactions).
- **Color Palette (50/35/15)**:
  - Dominant: `#315EC3` (50%) - Primary Blue
  - Subordinate: `#A0D9F6` (35%) - Light Blue
  - Accent: `#F1BFDB` (15%) - Soft Pink
- **Logo**: Minimum 110px size, present on all main screens.

### Design Principles
1. **Iconography Over Emojis**: Use Lucide icons for all functional and decorative UI elements. Remove emojis.
2. **Standardized Hierarchy**: Use card-based layouts with consistent shadows and spacing.
3. **Typography**: Use 'Kanit' with proper weighting for Thai/English readability.
4. **Interactive Feedback**: All buttons and actions must have hover and active states with smooth transitions.

## Technical Context
- **Framework**: Next.js 14+ (App Router), React 19.
- **Styling**: Vanilla CSS with Design Tokens (`globals.css`).
- **Icons**: `lucide-react`.
- **Database**: Supabase.
- **Integration**: LINE LIFF.
