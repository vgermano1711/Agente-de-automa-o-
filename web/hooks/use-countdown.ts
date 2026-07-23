"use client";

import { useEffect, useState } from "react";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffToCountdown(target: number, now: number): Countdown {
  const diff = Math.max(target - now, 0);
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/**
 * Countdown puramente visual (não é uma promoção real com prazo em banco).
 * Mira sempre o fim do domingo corrente, então nunca fica "expirado" — é só
 * pra dar senso de urgência na seção de promoções.
 */
export function useCountdown() {
  const [countdown, setCountdown] = useState<Countdown>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    function getTarget() {
      const now = new Date();
      const target = new Date(now);
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      target.setDate(now.getDate() + daysUntilSunday);
      target.setHours(23, 59, 59, 0);
      return target.getTime();
    }

    let target = getTarget();

    const tick = () => {
      const now = Date.now();
      if (now >= target) target = getTarget();
      setCountdown(diffToCountdown(target, now));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return countdown;
}
