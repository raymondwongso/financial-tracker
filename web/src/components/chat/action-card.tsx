import type { ChatCard } from '@ft/shared';
import { describeCard } from './describe-card';

export function ActionCard({
  card,
  selected,
  onSelect,
}: {
  card: ChatCard;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const d = describeCard(card);
  return (
    <button
      type="button"
      className={`action-card${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(card.id)}
      data-card-kind={card.kind}
    >
      <span className={`ac-icon tone-${d.tone}`}>
        <d.Icon />
      </span>
      <span className="ac-body">
        <span className="ac-label">{d.label}</span>
        <span className="ac-main">{d.main}</span>
        <span className="ac-meta">{d.meta}</span>
      </span>
      {d.amount ? <span className={`ac-amount ${d.amountClass ?? ''}`}>{d.amount}</span> : null}
    </button>
  );
}
