export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { age, sex, vitals, labs, notes } = req.body;

  const prompt = `
あなたは心臓血管外科ICUのシニア医師です。
以下の患者データを参考に、臨床的に有用な相談の返答を行ってください。

- Age: ${age}
- Sex: ${sex}
- Vitals: ${vitals}
- Labs: ${labs}
- Notes: ${notes}

出力はMarkdownの見出し（##）を用いて以下のセクションに分けてください:
- Problems
- Differentials
- Red flags
- Data to check
- Actions to consider
- Conference presentation points
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You are a medical consultant." }, { role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    res.status(200).json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
