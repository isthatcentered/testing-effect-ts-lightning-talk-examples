import { Effect, Duration } from "effect"

export class Freeze extends Effect.Tag("Freeze")<
	Freeze,
	{
		start(params: { timeout: Duration.Duration }): Effect.Effect<void>
		isFrozen: Effect.Effect<boolean>
	}
>() {}
