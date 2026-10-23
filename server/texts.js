"use strict";
const QUOTES = [
  ["The only way to do great work is to love what you do.", "Steve Jobs"],
  ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
  ["In the middle of every difficulty lies opportunity.", "Albert Einstein"],
  ["Whether you think you can, or you think you can't, you're right.", "Henry Ford"],
  ["The best way to predict the future is to invent it.", "Alan Kay"],
  ["Simplicity is prerequisite for reliability.", "Edsger Dijkstra"],
  ["Programs must be written for people to read, and only incidentally for machines to execute.", "Harold Abelson"],
  ["First, solve the problem. Then, write the code.", "John Johnson"],
  ["Premature optimization is the root of all evil.", "Donald Knuth"],
  ["Talk is cheap. Show me the code.", "Linus Torvalds"],
  ["Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", "Martin Fowler"],
  ["I have not failed. I've just found 10,000 ways that won't work.", "Thomas Edison"],
  ["Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill"],
  ["Stay hungry, stay foolish.", "Stewart Brand"],
  ["Do what you can, with what you have, where you are.", "Theodore Roosevelt"],
  ["A journey of a thousand miles begins with a single step.", "Lao Tzu"],
  ["Make it work, make it right, make it fast.", "Kent Beck"],
  ["Courage is not the absence of fear, but the triumph over it.", "Nelson Mandela"],
  ["The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"],
  ["Well done is better than well said.", "Benjamin Franklin"],
  ["You miss one hundred percent of the shots you never take.", "Wayne Gretzky"],
  ["Everything you can imagine is real.", "Pablo Picasso"],
  ["What we think, we become.", "Buddha"],
  ["The harder I work, the luckier I get.", "Gary Player"],
  ["Imagination is more important than knowledge, for knowledge is limited to all we now know and understand.", "Albert Einstein"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["Quality is not an act, it is a habit.", "Aristotle"],
  ["Fall seven times, stand up eight.", "Japanese proverb"],
  ["If you want to go fast, go alone. If you want to go far, go together.", "African proverb"],
  ["The mind is not a vessel to be filled, but a fire to be kindled.", "Plutarch"],
  ["Done is better than perfect, but shipped is better than done.", "Engineering wisdom"],
  ["Weeks of coding can save you hours of planning.", "Unknown"],
  ["There are only two hard things in computer science: cache invalidation and naming things.", "Phil Karlton"],
  ["Walking on water and developing software from a specification are easy if both are frozen.", "Edward V. Berard"],
  ["Measuring programming progress by lines of code is like measuring aircraft building progress by weight.", "Bill Gates"],
  ["The most dangerous phrase in the language is: we've always done it this way.", "Grace Hopper"],
  ["Debugging is twice as hard as writing the code in the first place.", "Brian Kernighan"],
  ["Software is eating the world, but typing is how you feed it.", "Racer proverb"],
  ["Speed is nothing without control, and control is nothing without practice.", "Racer proverb"],
  ["Slow is smooth, and smooth is fast.", "Racer proverb"],
];
const CODE = [
  "const sum = (a, b) => a + b; console.log([1, 2, 3].reduce(sum, 0));",
  "for (let i = 0; i < items.length; i++) { if (items[i].ok) total += items[i].price; }",
  "def fib(n): return n if n < 2 else fib(n - 1) + fib(n - 2)",
  "SELECT name, COUNT(*) FROM users WHERE active = 1 GROUP BY name ORDER BY 2 DESC;",
  "async function load(url) { const res = await fetch(url); return res.json(); }",
  "git commit -m \"fix: handle empty input\" && git push origin main",
  "fn main() { let v: Vec<u32> = (1..=10).filter(|x| x % 2 == 0).collect(); println!(\"{:?}\", v); }",
  "docker run -d --name web -p 8080:80 --restart unless-stopped nginx:alpine",
];
const WORDS = ("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us speed track engine turbo racing driver finish nitro lane corner shift clutch brake throttle boost").split(" ");

function pick(mode) {
  if (mode === "words") {
    const w = [];
    for (let i = 0; i < 32; i++) w.push(WORDS[(Math.random() * WORDS.length) | 0]);
    return { text: w.join(" "), src: "Random words" };
  }
  if (mode === "code") return { text: CODE[(Math.random() * CODE.length) | 0], src: "Code snippet" };
  const q = QUOTES[(Math.random() * QUOTES.length) | 0];
  return { text: q[0], src: "— " + q[1] };
}
module.exports = { pick };
