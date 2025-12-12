가능해요. 지금 스택(Next 15 + Tailwind v4 + shadcn/ui + Radix)이면 **“토큰(globals.css) + shadcn 기본 컴포넌트(Button/Card/Input…)”**만 손보면 전체 톤이 한 번에 바뀝니다.

아래는 **다크 + 터미널 + 레트로 픽셀(다마고치)** 컨셉으로 “디자인 소스 패키지” 뼈대예요. 그대로 복붙해서 적용하면 돼요.

---

## 0) 적용 대상 파일(최소 세트)

1. `app/globals.css` (토큰/배경/타이포)
2. `app/layout.tsx` (폰트 적용)
3. `components/ui/button.tsx` (shadcn 버튼 룩)
4. `components/ui/card.tsx` (shadcn 카드 룩)
   (+ 여유되면 `components/ui/input.tsx`, `badge.tsx`도 같은 방식으로)

---

## 1) `app/layout.tsx` (픽셀/터미널 폰트 톤)

> 픽셀 폰트는 가독성이 빡세서 **헤딩만 픽셀**, 본문은 **모노스페이스** 추천.

```tsx
// app/layout.tsx
import "./globals.css";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${mono.variable} ${pixel.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

---

## 2) `app/globals.css` (shadcn 토큰 + 픽셀/터미널 룩)

> shadcn은 기본적으로 **CSS 변수** 기반이라, 여기만 잘 잡으면 전체가 바뀝니다.

```css
@import "tailwindcss";

@layer base {
  :root {
    /* shadcn token set (light도 정의해두되, 우리는 dark 중심) */
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 47.4% 11.2%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 47.4% 11.2%;

    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    --radius: 0px; /* 픽셀 느낌: 둥근 모서리 제거 */
  }

  .dark {
    /* Retro Pixel Terminal Dark */
    --background: 222 47% 7%;          /* 거의 블랙에 가까운 네이비 */
    --foreground: 210 40% 96%;

    --card: 222 47% 9%;
    --card-foreground: 210 40% 96%;

    --popover: 222 47% 9%;
    --popover-foreground: 210 40% 96%;

    --primary: 145 80% 45%;            /* 터미널 그린 */
    --primary-foreground: 222 47% 7%;

    --secondary: 223 35% 14%;
    --secondary-foreground: 210 40% 96%;

    --muted: 223 35% 14%;
    --muted-foreground: 215 20% 70%;

    --accent: 196 90% 55%;             /* 사이버-시안 */
    --accent-foreground: 222 47% 7%;

    --destructive: 0 75% 55%;
    --destructive-foreground: 210 40% 96%;

    --border: 223 25% 22%;
    --input: 223 25% 22%;
    --ring: 145 80% 45%;

    --radius: 0px;
  }

  * { @apply border-border; }

  body {
    @apply bg-background text-foreground;
    font-family: var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  /* 헤딩만 픽셀 폰트 (가독성 유지) */
  h1, h2, h3, .font-pixel {
    font-family: var(--font-pixel), var(--font-mono), ui-monospace, monospace;
    letter-spacing: 0.02em;
  }
}

/* 픽셀/터미널 무드 배경(은은한 그리드 + 스캔라인) */
@layer utilities {
  .bg-terminal {
    background-image:
      linear-gradient(to right, hsl(var(--border) / 0.25) 1px, transparent 1px),
      linear-gradient(to bottom, hsl(var(--border) / 0.25) 1px, transparent 1px),
      linear-gradient(to bottom, hsl(var(--foreground) / 0.06), transparent 2px);
    background-size: 16px 16px, 16px 16px, 100% 6
```
