# Stride — Project Plan

## 1. Pitch

I'm building **Stride**, an all-in-one fitness app that brings workout planning, running, strength training, nutrition, and recovery into one place.

I'm currently training for a marathon on May 2, 2027, while lifting weights four days a week. I also incorporate cycling, Pilates, and physical therapy. Right now, I use several different apps to manage my training, nutrition, and recovery. I want a single place to see what I've planned, what I've actually completed, how I'm progressing, and how I'm feeling.

Stride will help users plan their weeks, track mileage, log their lifts while working out, monitor nutrition, and review their training history.

I'll use Stride daily to plan workouts and log food, during lifting sessions to record weights, and weekly to evaluate my training.

Eventually, I want Garmin to supply completed running data and Oura to supply daily health and recovery metrics. The initial version will work without these integrations.

## 2. Features

Each feature will be built on its own GitHub branch and merged through a pull request.

### Required Features

**Feature 1: User Authentication**

As a user, I want to create an account, log in, and log out so that my training and health information stays private.

Users will sign up with an email and password. Each user will have a record in the users table and will only be able to access their own personal data.

**Feature 2: Workout Database**

As a user, I want my workouts organized by activity type so that I can track all my training in one place.

The app will support running, strength training, cycling, Pilates, PT, and other activities. Each workout will belong to a user and a workout type.

**Feature 3: Workout Logging (CRUD)**

As a user, I want to add, view, edit, and delete workouts so that I can maintain an accurate training history.

Each workout will have a date, type, status (planned, in progress, or completed), and optional notes. Running workouts can include distance, duration, target pace, elevation, and run type. Deleting a workout will require confirmation.

**Feature 4: Input Validation**

As a user, I want clear messages when information is missing or invalid so that I don't accidentally save incorrect data.

Workout date and activity type will be required. Numeric fields cannot be negative, and required information cannot be left blank.

**Feature 5: Favorite Workouts**

As a user, I want to star workouts and access a favorites page so that I can easily find sessions I'd like to repeat.

Stars will be saved in one shared junction table connecting users and workouts. Users can only star workouts they are authorized to view.

**Feature 6: Search, Filter, and Sort**

As a user, I want to search workouts, filter by activity type or status, and sort by date so that I can find past training sessions.

**Feature 7: Training Dashboard**

As a user, I want to see weekly running mileage, completed workouts, and average running pace so that I can monitor my training progress.

The dashboard will include a weekly mileage chart. Only completed runs will contribute to actual mileage and pace calculations.

### Three Custom Features

**Feature 8: Flexible Weekly Training Planner**

As a runner, I want to see suggested workouts for the week, customize their distance and intensity, and schedule them around my availability so that my training plan fits my life.

Users will be able to:

- Set a weekly mileage target and preferred number of running days.
- Choose from workout templates: base/easy, recovery, long run, tempo/threshold, VO₂ max intervals, and sprints/strides.
- View suggested workout types with editable distance, target pace, duration/time on feet, and elevation.
- Move workouts between days and add strength training, Pilates, cycling, or rest days.
- See three separate mileage totals: target, scheduled, and completed.

The initial version will provide editable workout templates and a weekly planning interface, not a fully automated marathon coaching algorithm. Recommendations will be general starting points that users control.

**Feature 9: Interactive Strength Training and Progressive Overload**

As a user, I want to create lifting routines, follow them at the gym, and record weights and reps as I complete each set so that I can track progressive overload without using another app.

Users will be able to:

- Create and reuse lifting templates with exercises in a specific order.
- Set target sets and rep ranges for each exercise.
- Open a scheduled workout and see the full exercise list.
- Enter actual weights and reps during the workout.
- Mark individual sets as completed and save progress.
- See their previous performance when repeating an exercise.
- Review completed workouts and compare weights over time.

**Example workout: Posterior Strength Day**

This is an example from my actual training program that I'll enter after creating my account.

| Exercise | Sets | Target reps |
|---|---|---|
| B-stance Romanian deadlift | 4 | 6–8 per leg |
| Single-leg hip thrust | 4 | 8–10 per leg |
| Single-arm row | 3 | 8–10 |
| Lat pulldown | 3 | 8–12 |
| Reverse pec deck | 3 | 12–15 |
| Hammer curls | 3 | 10–12 |
| Face pulls (optional) | 2 | 12–15 |

For example, the app should let me complete a set of single-arm rows, enter 30 pounds for 10 reps, mark that set finished, and continue to the next set without leaving the workout screen.

The app will distinguish reusable templates from actual workout results.

**Feature 10: Nutrition and Recovery Journal**

As a user, I want to log what I eat and how I'm recovering so that I can evaluate my fueling alongside my training.

Nutrition functionality will include:

- Logging breakfast, lunch, dinner, and snacks.
- Entering foods with serving descriptions, calories, protein, carbohydrates, and fat.
- Calculating daily calorie and macro totals.
- Displaying progress toward customizable daily targets.

Recovery functionality will include:

- Daily sleep hours.
- Energy and soreness ratings from 1–5.
- Optional injury discomfort and recovery notes.
- Viewing recovery information alongside training activity.

The first version will use manual food entry. Saved meals, food database searches, and wearable imports are future improvements.

## 3. Database

Stride will use a relational PostgreSQL database through Supabase.

Every table will have a primary key. UUIDs will identify users and other records. Foreign keys will connect related tables.

| Table | Columns (name: type) | Primary key |
|---|---|---|
| users | id: UUID, email: text, created_at: timestamp | id |
| workout_types | id: UUID, name: text | id |
| workouts | id: UUID, user_id: UUID, workout_type_id: UUID, template_id: UUID optional, date: date, status: text, title: text, run_type: text optional, distance_miles: number optional, duration_minutes: number optional, target_pace: text optional, elevation_feet: number optional, notes: text optional | id |
| stars | id: UUID, user_id: UUID, workout_id: UUID | id |
| workout_templates | id: UUID, user_id: UUID, name: text, workout_type_id: UUID | id |
| exercises | id: UUID, user_id: UUID, name: text | id |
| template_exercises | id: UUID, template_id: UUID, exercise_id: UUID, position: number, target_sets: number, rep_min: number, rep_max: number, optional: true/false | id |
| workout_sets | id: UUID, workout_id: UUID, exercise_id: UUID, set_number: number, reps: number optional, weight_lbs: number optional, completed: true/false | id |
| weekly_goals | id: UUID, user_id: UUID, week_start: date, target_miles: number | id |
| nutrition_entries | id: UUID, user_id: UUID, date: date, meal_type: text, food_name: text, serving: text, calories: number, protein_g: number, carbs_g: number, fat_g: number | id |
| nutrition_goals | id: UUID, user_id: UUID, calories: number, protein_g: number, carbs_g: number, fat_g: number | id |
| recovery_entries | id: UUID, user_id: UUID, date: date, sleep_hours: number, energy_rating: number, soreness_rating: number, injury_notes: text optional | id |

**Database relationships**

- One user has many workouts, workout templates, exercises, nutrition entries, recovery entries, and weekly goals.
- One workout type can be associated with many workouts.
- One workout template contains many template exercises.
- Each template exercise references an exercise.
- One workout can have many completed sets.
- Each set references an exercise.
- The stars table connects users and workouts. The combination of user_id and workout_id must be unique.
- Each user has at most one weekly goal per week and one recovery entry per date.

**Data privacy:** Supabase Authentication will manage user identities, with a matching row in the users table. Row Level Security will protect user-owned records, including records accessed indirectly through workouts or templates. Public workout-type names can be shared, but private workouts, sets, favorites, nutrition, and recovery data cannot be accessed by other users.

**Planned vs. completed:** The app will keep both planned and completed workout information. Planned distances contribute to scheduled mileage; completed running distances contribute to actual mileage.

## 4. Tests

**Test 1: Data Isolation**

Given two registered users, User A and User B, and a workout belonging to User A, when User B logs in and tries to access that workout, then User B cannot view, modify, or delete it.

This checks that authentication and database security prevent users from accessing someone else's information.

**Test 2: Dashboard Mileage Calculation**

Given a user with three completed runs of 4, 5, and 6 miles during the same week and one planned run of 8 miles, when the dashboard calculates completed mileage, then it displays 15 miles.

This checks that the dashboard calculates totals correctly and excludes workouts that haven't been completed.

For each test, I will temporarily introduce a bug, capture a screenshot of the failing test, restore the correct implementation, and capture a screenshot of the passing test.

Each test's pull request will include a plain-English explanation and an example of a code change that would cause it to fail.

## 5. Technologies

| Technology | Why I'm using it |
|---|---|
| Replit Agent | AI coding assistant for building and testing features incrementally; I've used Replit before |
| GitHub | Tracks Issues, branches, pull requests, code changes, and prompt history |
| React + Vite | Creates a responsive, interactive web interface |
| Supabase PostgreSQL | Stores relational training, nutrition, and recovery data |
| Supabase Auth | Supports account creation, login, and secure user authentication |
| Replit deployment | Hosts the live app and supports updates after each feature |
| Recharts | Creates dashboard charts showing running mileage and other metrics |

Every feature will follow the same development loop: GitHub Issue, feature branch, agent prompt saved in `prompts/`, pull request referencing the Issue, merge, and deployment.

No changes will be committed directly to `main`.

## 6. Design

I want Stride to look clean, modern, and understated. The design should be polished but practical enough to use while running errands, planning my week, or lifting at the gym.

**Visual style**
- Warm white background with charcoal text and muted sage green accents.
- Simple typography, clear navigation, and generous whitespace.
- Easy-to-read charts, progress indicators, and workout lists.
- Mobile-friendly forms with large enough controls to use during exercise.
- Minimal visual clutter, without gradients or unnecessary animations.

**Design inspiration:** Oura's clear health metrics, Garmin's running analytics, and the simple set-by-set experience of strength-training journals.

The intended navigation is Today, Plan, Train, Fuel, and Insights. These may be simplified in the first release.

## 7. Risks and Cuts

**Biggest risk:** The interactive strength tracker and nutrition journal require multiple connected database tables. Building everything before the deadline may be difficult.

**Other risks:** Authentication and data privacy, saving partially completed workouts, and handling planned versus completed activities correctly.

**If time is limited, I'll cut or simplify:**
1. Automated run recommendations, keeping editable run templates.
2. Advanced strength progression charts, keeping previous-session comparisons.
3. Saved meals and recipes, keeping basic food entry and daily totals.
4. Detailed recovery analysis, keeping simple daily check-ins.
5. Optional visual enhancements and complex scheduling interactions.

I will prioritize reliable core functionality over ambitious unfinished features.

**Post-assignment roadmap**

After the initial version works, I want to add:

- **Garmin Personal API:** Import my completed runs, pace, mileage, duration, and other available activity data.
- **Oura API:** Import my daily sleep, readiness, HRV, resting heart rate, heart rate, steps, and other available recovery data.
- **Nutrition database:** Search foods, save frequently eaten meals, and build recipes.
- **Smarter running plans:** Suggest weekly workouts based on mileage, race goals, training history, and recovery while letting users modify the schedule.
- **Training insights:** Better analysis of strength progression, running volume, fueling, and recovery.

Garmin and Oura integrations will initially be available only for my personal account. All other users will still be able to use Stride through manual entry.

API credentials and tokens will be stored securely and never committed to GitHub.

## 8. Plan vs. Reality

*Complete this section after building the app. Preserve the original plan above so that changes are documented honestly.*

| Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why |
|---|---|---|---|---|
| Authentication | | | | |
| Workout database and CRUD | | | | |
| Validation | | | | |
| Stars | | | | |
| Search, filter, and sort | | | | |
| Dashboard | | | | |
| Weekly training planner | | | | |
| Strength training tracker | | | | |
| Nutrition and recovery journal | | | | |
| Garmin / Oura integrations (future) | | | | |
