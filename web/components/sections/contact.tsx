"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { contactFormSchema, type ContactFormValues } from "@/lib/validations";
import type { SiteSettings } from "@/types/site";

interface ContactProps {
  settings: SiteSettings;
}

export function Contact({ settings }: ContactProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
  });

  // Sem envio real: o formulário só valida e simula o envio (ver README do
  // projeto). Quando a API própria existir, troque o corpo desta função por
  // uma chamada fetch/server action — o resto do componente não muda.
  async function onSubmit(values: ContactFormValues) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    toast.success("Mensagem pronta para integração.", {
      description: `${values.name}, sua mensagem foi validada e está pronta pra ser enviada assim que a API estiver no ar.`,
    });
    reset();
  }

  return (
    <section id="contato" className="bg-charcoal py-24 md:py-32">
      <Container>
        <div className="grid gap-16 lg:grid-cols-2">
          <div className="flex flex-col gap-10">
            <Reveal>
              <SectionHeading
                eyebrow="Contato"
                title="Vamos preparar sua pizza?"
                description="Preencha o formulário ou fale direto pelo telefone — respondemos rápido nos dois canais."
                tone="dark"
              />
            </Reveal>

            <Reveal delay={0.1} className="flex flex-col gap-5">
              <a
                href={`tel:${settings.phone}`}
                className="flex items-center gap-4 rounded-xl border border-ivory/10 bg-graphite/40 p-4 text-ivory transition-colors hover:border-gold/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Phone className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ivory/50">Telefone</p>
                  <p className="font-medium">{settings.phoneDisplay}</p>
                </div>
              </a>

              <a
                href={`mailto:${settings.email}`}
                className="flex items-center gap-4 rounded-xl border border-ivory/10 bg-graphite/40 p-4 text-ivory transition-colors hover:border-gold/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Mail className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ivory/50">E-mail</p>
                  <p className="font-medium">{settings.email}</p>
                </div>
              </a>

              <div className="flex items-center gap-4 rounded-xl border border-ivory/10 bg-graphite/40 p-4 text-ivory">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ivory/50">Endereço</p>
                  <p className="font-medium">
                    {settings.address.street} — {settings.address.neighborhood},{" "}
                    {settings.address.city}/{settings.address.state}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="flex flex-col gap-5 rounded-2xl border border-ivory/10 bg-ivory/5 p-8 backdrop-blur-sm"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className="text-ivory">
                  Nome
                </Label>
                <Input
                  id="name"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  className="border-ivory/15 bg-charcoal/40 text-ivory placeholder:text-ivory/30"
                  {...register("name")}
                />
                {errors.name && (
                  <p id="name-error" role="alert" className="text-xs text-gold">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone" className="text-ivory">
                  Telefone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className="border-ivory/15 bg-charcoal/40 text-ivory placeholder:text-ivory/30"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p id="phone-error" role="alert" className="text-xs text-gold">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-ivory">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className="border-ivory/15 bg-charcoal/40 text-ivory placeholder:text-ivory/30"
                  {...register("email")}
                />
                {errors.email && (
                  <p id="email-error" role="alert" className="text-xs text-gold">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="message" className="text-ivory">
                  Mensagem
                </Label>
                <Textarea
                  id="message"
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "message-error" : undefined}
                  className="border-ivory/15 bg-charcoal/40 text-ivory placeholder:text-ivory/30"
                  {...register("message")}
                />
                {errors.message && (
                  <p id="message-error" role="alert" className="text-xs text-gold">
                    {errors.message.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                disabled={isSubmitting}
                className="mt-2"
              >
                <Send className="size-4" aria-hidden />
                {isSubmitting ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </form>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
