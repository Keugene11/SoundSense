import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/lib/stripe";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold">SoundSense</span>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <Badge variant="secondary" className="text-sm">
          Powered by AI
        </Badge>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight">
          Discover music you&apos;ll love, powered by your listening history
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          SoundSense connects to your YouTube Music account, analyzes your
          listening patterns, and generates personalized song recommendations
          using AI.
        </p>
        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <a href="#features">
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/50 px-4 py-24">
        <div className="container mx-auto">
          <h2 className="mb-12 text-center text-3xl font-bold">
            How it works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Connect YouTube Music",
                description:
                  "Link your YouTube Music account to import your listening history and discover your musical patterns.",
              },
              {
                title: "AI Analysis",
                description:
                  "Our AI analyzes your listening habits, favorite genres, and mood preferences to understand your taste.",
              },
              {
                title: "Get Recommendations",
                description:
                  "Receive personalized song recommendations with explanations of why you'll enjoy each track.",
              },
            ].map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-24">
        <div className="container mx-auto">
          <h2 className="mb-12 text-center text-3xl font-bold">Pricing</h2>
          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
            {(["free", "pro"] as const).map((planKey) => {
              const plan = PLANS[planKey];
              return (
                <Card
                  key={planKey}
                  className={
                    planKey === "pro" ? "border-primary shadow-lg" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {plan.name}
                      {planKey === "pro" && <Badge>Popular</Badge>}
                    </CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">
                        ${plan.price}
                      </span>
                      {planKey === "pro" && (
                        <span className="text-muted-foreground">/month</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <span className="text-green-500">&#10003;</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link href="/login" className="mt-6 block">
                      <Button
                        className="w-full"
                        variant={planKey === "pro" ? "default" : "outline"}
                      >
                        {planKey === "pro" ? "Start Pro" : "Get Started"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} SoundSense. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
