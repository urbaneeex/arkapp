import Image from 'next/image'

type Props = {
  className?: string
  size?: number
}

/** Logo multicolor de Google desde asset en `public/` (guías de marca Sign-In). */
export function GoogleBrandIcon({ className, size = 20 }: Props) {
  return (
    <Image
      src="/brand/google-g.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  )
}
