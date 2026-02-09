import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

const LazyImage = ({ src, alt, className }) => {
  const containerRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible) return undefined

    const element = containerRef.current
    if (!element) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: '120px' }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className={`h-full w-full bg-slate-100 ${className}`}
    >
      {isVisible ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  )
}

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
}

LazyImage.defaultProps = {
  className: '',
}

export default LazyImage
