export interface Image<Data> {
  string_to_data(query_string: string): Data
  data_to_react(data: Data): React.ReactElement<{}>
  key: string
}
