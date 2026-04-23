import Link from 'next/link'
import React from 'react'

const DashboardLink: React.FC = () => {
  return (
    <Link href="/admin" className="nav__link nav__link--dashboard">
      Dashboard
    </Link>
  )
}

export default DashboardLink
