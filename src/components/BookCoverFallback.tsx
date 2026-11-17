import React from 'react';
import { BookCover, BookCoverProps } from './BookCover';

export const BookCoverFallback: React.FC<BookCoverProps> = (props) => {
  return <BookCover {...props} />;
};
