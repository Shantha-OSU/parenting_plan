# ShareCare — Frontend

ShareCare is a React web application that guides co-parents through a step-by-step questionnaire to generate a court-ready Ohio Shared Parenting Plan. It connects to a Node.js/Express backend and uses Firebase for authentication.

---

## Prerequisites

| Software | Minimum Version | Check | Download |
|---|---|---|---|
| Node.js | v18.0.0+ | `node --version` | https://nodejs.org/ |
| npm | v9.0.0+ | `npm --version` | Included with Node.js |
| Git | v2.0.0+ | `git --version` | https://git-scm.com/ |


---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Yuris2/parenting_project.git
cd parenting_project/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the Firebase config values for your project. All `VITE_FIREBASE_*` variables are required or the app will not authenticate without them.

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

> Never commit real Firebase credentials to the repository.

### 4. Start the development server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. You should see the ShareCare landing page.

> The backend must be running on port 3000 for API calls to succeed. Visit `http://localhost:3000/api/health` to confirm the backend and database are connected before testing the full flow.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server (auto-reload) |
| `npm start` | Start server (production) |
| `docker compose up -d` | Start MongoDB |
| `docker compose down ` | Stop MongoDB |
| `docker compose down -v` | Stop + delete data |
| `npm run test` | Run tests in watch mode |
| `npm run test -- fileName` | Run a single test file |
| `npm run test:coverage` | Generate test coverage report |
| `npm run test:ui` | Open Vitest visual dashboard |

---

## Project Structure

```
frontend/
├── src/
│   ├── assets/
│   │   ├── logos/          # ShareCare logo 
│   │   |    └── ShareCare_Symmetrical Diamond Logo.png /   
│   ├── components/
│   │   ├── common/         # Layout and modal components
│   │   │   ├── card.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── InviteModal.jsx
│   │   │   └── LegalNoticeModal.jsx
│   │   └── forms/          # Form inputs and composite question cards
│   │       ├── TextInput.jsx
│   │       ├── DatePicker.jsx
│   │       ├── Dropdown.jsx
│   │       ├── RadioButton.jsx
│   │       ├── Checkbox.jsx
│   │       ├── ChildCheckboxList.jsx
│   │       ├── ScheduleBuilder.jsx
│   │       ├── TextQuestion.jsx
│   │       ├── RadioQuestion.jsx
│   │       ├── PolicyAgreementQuestion.jsx
│   │       ├── SafetyPrivacyQuestion.jsx
│   │       ├── SectionHeader.jsx
│   │       ├── FlagButton.jsx
│   │       └── Disclaimer.jsx
│   ├── context/
│   │   ├── FormContext.jsx       # Global questionnaire state (useReducer + localStorage)
│   │   └── NavigationContext.jsx # Back/Next callback injection for questionnaire steps
│   ├── hooks/
│   │   ├── useForm.js            # Reads FormContext; throws if used outside FormProvider
│   │   └── useSectionFlag.js     # Manages per-question flag state via UPDATE_FLAG
│   ├── layouts/
│   │   └── MainLayout.jsx        # Authenticated shell: Sidebar, Header, Footer, nav logic
│   ├── lib/
│   │   ├── firebase.js           # Firebase app initialization
│   │   ├── apiClient.js          # buildApiUrl() helper for base URL management
│   │   ├── authApi.js            # syncFirebaseUserProfileSafely()
│   │   └── inviteApi.js          # sendCaseInvite(), getPendingInviteLink()
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── SignIn.jsx
│   │   │   └── SignUp.jsx
│   │   ├── LandingPage.jsx
│   │   ├── Dashboard.jsx
│   │   ├── GettingStarted.jsx
│   │   ├── ParentalRights.jsx
│   │   ├── ParentingTimeAndCommunication.jsx
│   │   ├── InformationSharing.jsx
│   │   ├── TaxExemptions.jsx
│   │   ├── Review.jsx
│   │   ├── Comparison.jsx
│   │   ├── ResolutionReview.jsx
│   │   ├── FinalResolution.jsx
│   │   ├── WaitingScreen.jsx
│   │   ├── InviteAccept.jsx
│   │   ├── TermsOfService.jsx
│   │   ├── PrivacyPolicy.jsx
│   │   └── ContactSupport.jsx
│   └── utils/
│       └── renderWithRouter.jsx  # Shared test utility (MemoryRouter + FormProvider + NavigationProvider)
├── tests/
│   ├── components/               # Component unit tests
│   ├── layouts/                  # Layout unit tests
│   └── pages/                    # Page integration tests
├── .env.example
├── index.html
├── README.md
├── index.html
├── vite.config.js
└── package.json
```

---

## Application Flow

```
/ (LandingPage)
  └── /signup → /signin → /dashboard
        └── /getting-started
              └── /parental-rights
                    └── /parenting-time-communication
                          └── /informationsharing
                                └── /tax-exemptions
                                      └── /review
                                            └── /comparison/:caseId (collaborative mode)
                                                  └── /resolution-review/:caseId  (Parent 2)
                                                  └── /resolution/:caseId         (Parent 1)
                                                  └── /waiting/:caseId            (polling)
```

Questionnaire steps (`/getting-started` through `/review`) are wrapped in `MainLayout`, which owns all Back/Next/Save navigation logic and API calls to the logic engine.

---

## State Management

Global form state is managed by `FormContext` using React's `useReducer`. State is automatically persisted to `localStorage` on every change and rehydrated on page load.

Key state slices: `plan`, `parents`, `children`, `question`, `currAnswer`, `collaborationMode`, `flags`, and one slice per questionnaire step.

Four action types: `UPDATE_SECTION`, `UPDATE_FLAG`, `LOAD_SAVED`, `RESET`.

Access state in any component via the `useForm` hook:

```jsx
import { useForm } from '../hooks/useForm'

const { state, dispatch } = useForm()
```

---

## Authentication

Firebase Auth handles all authentication. The pattern for making authenticated API calls:

```js
const idToken = await user.getIdToken()

const response = await fetch(buildApiUrl('/api/plan/' + planId), {
  headers: { Authorization: `Bearer ${idToken}` }
})
```

Always call `user.getIdToken()` immediately before each request — never cache the token. Firebase refreshes it automatically when close to expiry.

---

## Testing

Tests are written with [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/).

```bash
# Run all tests
npm run test -- --run

# Watch mode
npm run test

# Coverage report
npm run test:coverage
```

Use `renderWithRouter` from `src/utils/renderWithRouter.jsx` for page-level tests — it wraps the component in `MemoryRouter`, `FormProvider`, and `NavigationProvider`, mirroring the production layout:

```jsx
import { renderWithRouter } from '../../src/utils/renderWithRouter'

it('renders without crashing', () => {
  renderWithRouter(<MyPage />)
})
```

Seed `localStorage` before rendering if the component reads form state:

```js
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('sharedCareForm', JSON.stringify({ /* state shape */ }))
})
```

Before opening a pull request, run:

```bash
npm run lint
npm run test -- --run
```

Both must pass with no errors.

---

## Legal and Safety Notes

This codebase handles sensitive family law data. A few rules apply to all contributors:

- All disclaimer and legal notice text must be modified through `src/utils/disclaimerText.js` and requires legal team sign-off before merging
- Parent address and contact information must never be shared between co-parents — this is enforced via `collaborationMode` and must be preserved in any changes to the comparison or resolution flow
- See Section 9d of the Developer Manual for more information related to legal disclaimers

---

*Last updated: April 2026*
