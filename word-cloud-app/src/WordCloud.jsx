const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea",
  "#ea580c", "#0891b2", "#c026d3", "#4f46e5",
];

function WordCloud({ words }) {
  if (!words.length) return null;

  const maxCount = Math.max(...words.map((w) => w.count));
  const minSize = 14;
  const maxSize = 64;

  return (
    <div className="cloud" role="img" aria-label="Word cloud visualization">
      {words.map((word, i) => {
        const size = minSize + ((word.count / maxCount) * (maxSize - minSize));
        const color = COLORS[i % COLORS.length];

        return (
          <span
            key={word.text}
            className="cloud-word"
            style={{ fontSize: `${size}px`, color }}
            title={`${word.text}: ${word.count}`}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}

export default WordCloud;
