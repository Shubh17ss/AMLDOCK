import { Link as RouterLink } from 'react-router-dom';

/**
 * The site's one button. `to` renders a router link, `href` a plain anchor, neither a <button>.
 * variant: primary | ghost | onDark | ghostOnDark
 */
export function Button({ to, href, variant = 'primary', size, block, className = '', children, ...rest }) {
  const cls = [
    'site-btn', `site-btn--${variant}`,
    size === 'sm' ? 'site-btn--sm' : '', block ? 'site-btn--block' : '', className,
  ].filter(Boolean).join(' ');
  if (to) return <RouterLink to={to} className={cls} {...rest}>{children}</RouterLink>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
