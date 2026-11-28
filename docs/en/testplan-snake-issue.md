# Issue: Implement a browser-based Snake game

## Goal

Implement a small, independently playable Snake game for the browser. The
solution must work without a backend, allow deterministic game behavior, and
keep the core logic clearly separate from presentation.

## User stories and behavior

- As a player, I can start a new game and immediately see the board.
- The snake moves in discrete ticks with exactly one valid movement direction.
- As a player, I steer using the keyboard and, if sensibly provided, accessible
  touch controls.
- When the snake reaches food, it grows and the score increases.
- Food is selected deterministically and appears only on an unoccupied cell.
- Wall or self-collision ends the game with an unambiguous game-over state.
- After game over, I can restart without reloading the page.
- The score remains understandable during start, play, game over, and restart.

## Controls

- Support arrow keys and, if exposed by the UI, `WASD`.
- A single input queues at most one direction change per tick.
- The immediately opposite direction is rejected.
- Repeated or diagonal input never causes two cell moves in one tick.
- Mobile or touch support is optional; when provided, it must use the same
  input rules and suitably sized targets.

## Score

- Start every run at `0` points.
- Consuming food increases the score by one fixed, documented amount.
- Food consumption and score changes originate in the same state transition.
- The displayed score must match the core state.

## Collision, game over, and restart

- Moving the new head into a wall ends the run immediately.
- Moving the head onto an occupied body segment ends the run immediately.
- After game over, further movement actions stop and the UI clearly identifies
  the state.
- Restart restores the snake, direction, food, score, and run state to the
  defined initial state.
- Repeated restart clicks must not create multiple timers or game loops.

## Deterministic core logic

- Implement core logic as pure or dependency-injected functions, independent
  of the DOM, wall-clock time, and global randomness.
- Use a fixed random seed or inject the random generator for tests.
- The same initial state and input/tick sequence always produce the same final
  state.
- Keep ticking, direction intake, food placement, collision detection,
  scoring, and restart clearly testable as steps or functions.

## UI, responsive behavior, and accessibility

- Keep the board usable on desktop and mobile sizes without horizontal
  overflow.
- Provide focus support, keyboard operation, and visible control guidance.
- Expose game-over and score changes to screen readers.
- Relevant colors have sufficient contrast; meaning is not conveyed by color
  alone.
- Do not automatically play audio, motion effects, or fullscreen content.

## Technical constraints

- Use the frontend and build structure already established in the consumer
  repository. Do not add a backend dependency.
- Add concise, clear start and test commands to the README.
- Keep secrets, external services, and production-specific configuration out
  of the implementation.
- Apply dependent state changes atomically for each tick.

## Acceptance criteria

- The game can be started locally and played in a browser.
- Initial state and restart are identical and reproducible.
- Arrow keys, optional `WASD`, growth, score, collisions, game over, and restart
  follow the specified rules.
- Direct reversal is blocked; at most one step occurs per tick.
- Core logic is testable without a browser or timing dependencies.
- The same seed and action sequence produces byte-for-byte equivalent state.
- Responsive UI and defined accessibility behavior have been checked.
- Build, check, and automated tests complete without errors.
- The README documents startup, controls, tests, and technical limits.

## Tests

At minimum, automated tests must prove:

- deterministic initial state with a fixed seed;
- movement in every direction without diagonal steps;
- rejection of the directly opposite direction;
- food placement only on unoccupied cells;
- growth and score increase after consumption;
- wall collision and self-collision;
- game over stops further ticks;
- restart restores the initial state;
- identical action sequences produce identical state;
- repeated restart does not create a second game loop.

Also manually verify a desktop browser and a narrow viewport: visible board,
controls, focus, game over, restart, overflow, console output, and failed
network requests.

## Out of scope

- Multiplayer, leaderboards, accounts, persistence, or a backend;
- AI players, levels, power-ups, and complex animation;
- audio effects and external telemetry;
- automatically marking a PR ready, approving, or merging it;
- permission, secret, or Project/issue-management changes beyond the issue
  reference required for implementation.
