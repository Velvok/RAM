'use client'

import * as React from 'react'
import { SelectField } from '@/components/ui/select-field'

// Alias de compatibilidad: todo <Select> de la app abre ya el desplegable
// propio (select-field.tsx), con el mismo API que un <select> nativo.
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(props, _ref) {
  return <SelectField {...props} />
})

export { Select }
