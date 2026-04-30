import { useState } from "react";
import WordCloud from "./WordCloud";

const SAMPLE_TEXT = `DevOps is a set of practices that combines software development and IT operations.
It aims to shorten the systems development life cycle and provide continuous delivery
with high software quality. DevOps is complementary with Agile software development.
Continuous integration continuous delivery continuous deployment automation testing
monitoring feedback pipeline infrastructure code version control collaboration`;

function App() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/wordcloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setWords(data.words);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Word Cloud Generator</h1>
      <p className="subtitle">
        Paste text below and generate a word cloud visualization
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your text here..."
          rows={6}
          aria-label="Text input"
        />
        <button type="submit" disabled={loading || !text.trim()}>
          {loading ? "Generating..." : "Generate Word Cloud"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {words.length > 0 && <WordCloud words={words} />}
    </div>
  );
}

export default App;
