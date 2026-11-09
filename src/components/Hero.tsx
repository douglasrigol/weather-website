import { useRef } from 'react';
import { formatLongDate } from '../lib/format';
import { gsap, SplitText, useGSAP } from '../lib/gsap';
import { daySummary } from '../lib/summary';
import { describeWeather } from '../lib/weather';
import type { DayPoint, Forecast, Unit } from '../types';
import { WeekCurve } from './WeekCurve';

interface Props {
  forecast: Forecast;
  selectedDay: number;
  onSelectDay: (index: number) => void;
  unit: Unit;
  reducedMotion: boolean;
}

export function Hero({ forecast, selectedDay, onSelectDay, unit, reducedMotion }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const day: DayPoint = forecast.daily[selectedDay];
  const isToday = selectedDay === 0;
  const code = isToday ? forecast.current.code : day.code;
  const title = describeWeather(code).label;
  const badge = isToday ? 'Agora' : formatLongDate(day.date);

  // título entra letra por letra sempre que muda
  useGSAP(
    () => {
      if (reducedMotion || !titleRef.current) return;
      const split = SplitText.create(titleRef.current, { type: 'words,chars', mask: 'words' });
      gsap.from(split.chars, {
        yPercent: 110,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.018,
      });
      return () => split.revert();
    },
    { dependencies: [title, reducedMotion], revertOnUpdate: true },
  );

  return (
    <section className="hero reveal" aria-labelledby="hero-title">
      <p className="chip">{badge}</p>
      <h1 id="hero-title" ref={titleRef} key={title}>
        {title}
      </h1>
      <p className="hero__summary">{daySummary(day, unit)}</p>
      <WeekCurve
        days={forecast.daily}
        selected={selectedDay}
        onSelect={onSelectDay}
        unit={unit}
        reducedMotion={reducedMotion}
      />
    </section>
  );
}
