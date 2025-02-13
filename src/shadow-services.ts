import { Data, pipe, Effect, Array, Brand, Schema } from "effect"

export type EmailAddress = Brand.Branded<string, "EMAIL_ADDRES">
export const makeEmailAddress = Brand.nominal<EmailAddress>()

class Mailable<A> extends Data.Class<{
	subject: string
	body: string
	variables: Schema.Schema<A>
}> {}

export class Email<A> extends Data.Class<{
	mailable: Mailable<A>
	recipient: EmailAddress
	variables: A
}> {}

export class Mailer extends Effect.Tag("Mailer")<
	Mailer,
	{ sendEmail(email: Email<any>): Effect.Effect<void> }
>() {}

export class User extends Data.Class<{
	email: EmailAddress
	hasSubscription: boolean
}> {}

export class UserRepository extends Effect.Tag("UserGateway")<
	UserRepository,
	{
		list: Effect.Effect<User[]>
		create: (user: User) => Effect.Effect<void>
	}
>() {}

const BuySubscriptionMailable = new Mailable({
	subject: "Buy subscription",
	body: "Pretty please",
	variables: Schema.Void,
})

export const sendBuySubscriptionEmail = pipe(
	UserRepository.list,
	Effect.flatMap(users =>
		pipe(
			users,
			Array.filter(u => !u.hasSubscription),
			Array.map(
				u =>
					new Email({
						mailable: BuySubscriptionMailable,
						recipient: u.email,
						variables: undefined,
					}),
			),
			Effect.forEach(email => Mailer.sendEmail(email)),
		),
	),
)
